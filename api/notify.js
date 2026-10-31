const admin = require("firebase-admin");

let firebaseApp;
const rateLimitsByUid = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_NOTIFY_REQUESTS_PER_WINDOW = 60;
const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_RECIPIENTS = 50;

const getFirebaseApp = () => {
  if (firebaseApp) return firebaseApp;

  const encodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!encodedServiceAccount) {
    throw new Error("Firebase service account is not configured");
  }

  const serviceAccount = JSON.parse(
    Buffer.from(encodedServiceAccount, "base64").toString()
  );
  firebaseApp = admin.apps.length
    ? admin.app()
    : admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return firebaseApp;
};

const hasChat = (userChats, chatId) =>
  Object.prototype.hasOwnProperty.call(userChats, chatId);

const isRateLimited = (uid) => {
  const now = Date.now();
  const current = rateLimitsByUid.get(uid);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimitsByUid.set(uid, { startedAt: now, count: 1 });
    if (rateLimitsByUid.size > 1000) {
      const oldestUid = rateLimitsByUid.keys().next().value;
      rateLimitsByUid.delete(oldestUid);
    }
    return false;
  }
  if (current.count >= MAX_NOTIFY_REQUESTS_PER_WINDOW) return true;
  current.count += 1;
  return false;
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authorization = req.headers.authorization || "";
  const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const app = getFirebaseApp();
    let decodedToken;
    try {
      decodedToken = await admin.auth(app).verifyIdToken(bearerMatch[1]);
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (isRateLimited(decodedToken.uid)) {
      res.setHeader("Retry-After", String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)));
      return res.status(429).json({ error: "Too many notification requests" });
    }

    const declaredLength = Number(req.headers["content-length"]);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return res.status(413).json({ error: "Request body is too large" });
    }
    if (
      typeof req.body === "string" &&
      Buffer.byteLength(req.body, "utf8") > MAX_REQUEST_BYTES
    ) {
      return res.status(413).json({ error: "Request body is too large" });
    }

    let requestBody;
    try {
      requestBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return res.status(400).json({ error: "Invalid request body" });
    }
    if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody)) {
      return res.status(400).json({ error: "Invalid request body" });
    }
    if (Buffer.byteLength(JSON.stringify(requestBody), "utf8") > MAX_REQUEST_BYTES) {
      return res.status(413).json({ error: "Request body is too large" });
    }

    const { chatId, recipientUids, title, body } = requestBody || {};
    let invalidField = null;
    if (typeof chatId !== "string" || !chatId || chatId.length > 200) {
      invalidField = "chatId";
    } else if (
      !Array.isArray(recipientUids) ||
      recipientUids.length > MAX_RECIPIENTS ||
      recipientUids.some((uid) => typeof uid !== "string" || !uid || uid.length > 128)
    ) {
      invalidField = "recipientUids";
    } else if (typeof title !== "string" || title.length > 120) {
      invalidField = "title";
    } else if (typeof body !== "string" || body.length > 1000) {
      invalidField = "body";
    }
    if (invalidField) {
      console.warn("notify invalid body field:", invalidField);
      return res.status(400).json({ error: "Invalid request body" });
    }

    const db = admin.firestore(app);
    const senderUid = decodedToken.uid;
    const senderChat = await db.collection("userChats").doc(senderUid).get();
    if (!senderChat.exists || !hasChat(senderChat.data() || {}, chatId)) {
      return res.status(403).json({ error: "Chat access denied" });
    }

    const candidates = [...new Set(recipientUids)].filter((uid) => uid !== senderUid);
    const authorizedRecipients = await Promise.all(
      candidates.map(async (uid) => {
        const [chatDoc, userDoc] = await Promise.all([
          db.collection("userChats").doc(uid).get(),
          db.collection("users").doc(uid).get(),
        ]);
        if (!chatDoc.exists || !hasChat(chatDoc.data() || {}, chatId)) return null;
        const mutedUntil = userDoc.data()?.chatPrefs?.[chatId]?.mutedUntil || 0;
        return mutedUntil > Date.now() ? null : uid;
      })
    );
    const authorizedRecipientUids = authorizedRecipients.filter(Boolean);
    console.info("notify recipients authorized:", authorizedRecipientUids.length);

    const tokenOwners = new Map();
    await Promise.all(
      authorizedRecipientUids.map(async (uid) => {
        const tokenDoc = await db.collection("fcmTokens").doc(uid).get();
        const savedTokens = tokenDoc.data()?.tokens;
        if (!Array.isArray(savedTokens)) return;

        for (const token of savedTokens) {
          if (typeof token !== "string" || !token) continue;
          if (!tokenOwners.has(token)) tokenOwners.set(token, new Set());
          tokenOwners.get(token).add(uid);
        }
      })
    );

    const tokenEntries = [...tokenOwners.entries()];
    console.info("notify tokens found:", tokenEntries.length);
    if (tokenEntries.length === 0) {
      console.info("notify sent/failed:", 0, 0);
      return res.status(200).json({ sent: 0, failed: 0, errorCodes: [] });
    }

    const messaging = admin.messaging(app);
    const deadTokensByUid = new Map();
    const errorCodes = new Set();
    let sent = 0;
    let failed = 0;

    for (let offset = 0; offset < tokenEntries.length; offset += 500) {
      const batch = tokenEntries.slice(offset, offset + 500);
      const result = await messaging.sendEachForMulticast({
        tokens: batch.map(([token]) => token),
        data: {
          title,
          body: body.slice(0, 120),
          chatId,
          icon: "/icon-192.png",
        },
        webpush: { headers: { Urgency: "high", TTL: "86400" } },
      });

      sent += result.successCount;
      failed += result.failureCount;
      result.responses.forEach((response, index) => {
        if (!response.success) {
          const errorCode = response.error?.code || "unknown";
          errorCodes.add(errorCode);
          console.error("push failed:", errorCode);
        }

        const errorCode = response.error?.code;
        if (
          errorCode !== "messaging/registration-token-not-registered" &&
          errorCode !== "messaging/invalid-registration-token"
        ) {
          return;
        }

        for (const uid of tokenOwners.get(batch[index][0]) || []) {
          if (!deadTokensByUid.has(uid)) deadTokensByUid.set(uid, new Set());
          deadTokensByUid.get(uid).add(batch[index][0]);
        }
      });
    }

    const fieldValue = admin.firestore.FieldValue;
    const cleanupResults = await Promise.allSettled(
      [...deadTokensByUid.entries()].map(([uid, tokens]) =>
        db.collection("fcmTokens").doc(uid).update({
          tokens: fieldValue.arrayRemove(...tokens),
        })
      )
    );
    const cleanupFailures = cleanupResults.filter((result) => result.status === "rejected");
    if (cleanupFailures.length > 0) {
      console.warn("Could not remove invalid push tokens:", cleanupFailures.length);
    }

    console.info("notify sent/failed:", sent, failed);
    return res.status(200).json({ sent, failed, errorCodes: [...errorCodes] });
  } catch (error) {
    console.error("notify error:", error && error.code);
    return res.status(500).json({ error: "Notification request failed" });
  }
};