const admin = require("firebase-admin");

let firebaseApp;

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

    const requestBody =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { chatId, recipientUids, title, body } = requestBody || {};
    if (
      typeof chatId !== "string" ||
      !chatId ||
      !Array.isArray(recipientUids) ||
      recipientUids.some((uid) => typeof uid !== "string") ||
      typeof title !== "string" ||
      typeof body !== "string"
    ) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const db = admin.firestore(app);
    const senderUid = decodedToken.uid;
    const senderChat = await db.collection("userChats").doc(senderUid).get();
    if (!senderChat.exists || !hasChat(senderChat.data() || {}, chatId)) {
      return res.status(403).json({ error: "Chat access denied" });
    }

    const candidates = [...new Set(recipientUids)]
      .filter((uid) => uid && uid !== senderUid)
      .slice(0, 50);
    const authorizedRecipients = await Promise.all(
      candidates.map(async (uid) => {
        const chatDoc = await db.collection("userChats").doc(uid).get();
        return chatDoc.exists && hasChat(chatDoc.data() || {}, chatId) ? uid : null;
      })
    );

    const tokenOwners = new Map();
    await Promise.all(
      authorizedRecipients.filter(Boolean).map(async (uid) => {
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
    if (tokenEntries.length === 0) {
      return res.status(200).json({ sent: 0, failed: 0 });
    }

    const messaging = admin.messaging(app);
    const deadTokensByUid = new Map();
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
    await Promise.allSettled(
      [...deadTokensByUid.entries()].map(([uid, tokens]) =>
        db.collection("fcmTokens").doc(uid).update({
          tokens: fieldValue.arrayRemove(...tokens),
        })
      )
    );

    return res.status(200).json({ sent, failed });
  } catch {
    return res.status(500).json({ error: "Notification request failed" });
  }
};