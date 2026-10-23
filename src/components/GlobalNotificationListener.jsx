import { useContext, useEffect, useRef } from "react";
import { useLocation, matchPath } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { ChatContext, UserDocumentContext } from "../context/ChatContext";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { notifyMessage, updateTitleUnread } from "../utils/notify";
import { registerPushToken } from "../utils/pushToken";

/**
 * Top-level persistent notification and unread counter listener.
 * Remains mounted across all routes and views as long as the user is authenticated.
 * Eliminates missing notifications when navigating between chats, profiles, or when Chrome is in the background.
 */
const GlobalNotificationListener = () => {
  const { currentUser } = useContext(AuthContext);
  const { data: chatContextData } = useContext(ChatContext);
  const userDocument = useContext(UserDocumentContext);
  const chatPrefsRef = useRef(userDocument.chatPrefs || {});
  const location = useLocation();

  // Match URL to get active chat ID accurately
  const match = matchPath("/chat/:chatId", location.pathname);
  const activeChatId = match?.params?.chatId || chatContextData?.chatId || null;
  const activeChatIdRef = useRef(activeChatId);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    chatPrefsRef.current = userDocument.chatPrefs || {};
  }, [userDocument.chatPrefs]);

  const notifiedIdsRef = useRef(new Set());
  const isFirstSnapshotRef = useRef(true);
  const sessionStartTimeRef = useRef(Date.now());
  const currentUserId = currentUser?.uid;

  useEffect(() => {
    if (currentUserId && typeof Notification !== "undefined" && Notification.permission === "granted") {
      registerPushToken({ uid: currentUserId });
    }
  }, [currentUserId]);

  // Listen to window focus and visibility to reset tab title
  useEffect(() => {
    const handleFocus = () => {
      updateTitleUnread(0);
    };

    const handleVisibility = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        updateTitleUnread(0);
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;

    isFirstSnapshotRef.current = true;
    sessionStartTimeRef.current = Date.now();

    const unsub = onSnapshot(
      doc(db, "userChats", currentUser.uid),
      (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data() || {};

        // On initial snapshot load, seed existing message IDs so old history never alerts
        if (isFirstSnapshotRef.current) {
          isFirstSnapshotRef.current = false;
          Object.entries(data).forEach(([cId, cData]) => {
            const msg = cData?.lastMessage;
            if (msg) {
              const msgTime =
                typeof msg.date === "number"
                  ? msg.date
                  : msg.date?.toMillis
                  ? msg.date.toMillis()
                  : msg.date?.seconds
                  ? msg.date.seconds * 1000
                  : 0;
              const msgId = msg.id || `${cId}_${msgTime}_${msg.senderId}_${msg.text || ""}`;
              notifiedIdsRef.current.add(msgId);
            }
          });
          return;
        }

        // Process incoming messages across all chats
        Object.entries(data).forEach(([cId, cData]) => {
          const newLastMsg = cData?.lastMessage;
          if (!newLastMsg) return;

          const msgTime =
            typeof newLastMsg.date === "number"
              ? newLastMsg.date
              : newLastMsg.date?.toMillis
              ? newLastMsg.date.toMillis()
              : newLastMsg.date?.seconds
              ? newLastMsg.date.seconds * 1000
              : 0;

          const msgId =
            newLastMsg.id ||
            `${cId}_${msgTime}_${newLastMsg.senderId}_${newLastMsg.text || ""}`;

          const isNotMe = newLastMsg.senderId !== currentUser.uid;
          const notYetNotified = !notifiedIdsRef.current.has(msgId);

          // Only notify messages sent around or after this session began (avoiding old unread replay)
          const isCurrentSessionMessage =
            msgTime === 0 || msgTime >= sessionStartTimeRef.current - 15000;

          if (isNotMe && notYetNotified && isCurrentSessionMessage) {
            notifiedIdsRef.current.add(msgId);

            // Determine if the user is currently looking at this specific conversation
            const isDocHidden =
              typeof document !== "undefined" &&
              (document.hidden || document.visibilityState === "hidden");
            const isWindowUnfocused =
              typeof document !== "undefined" &&
              typeof document.hasFocus === "function" &&
              !document.hasFocus();
            const isDifferentChat = cId !== activeChatIdRef.current;

            // Trigger alert if app is backgrounded, window is unfocused, or user is in a different chat
            const isMuted = (chatPrefsRef.current?.[cId]?.mutedUntil || 0) > Date.now();
            if (!isMuted && (isDocHidden || isWindowUnfocused || isDifferentChat)) {
              const senderName = cData.userInfo?.displayName || "New Message";
              const messageText = newLastMsg.text || "Sent a message";
              const photoURL = cData.userInfo?.photoURL || "/icon-192.png";

              notifyMessage({
                chatId: cId,
                title: senderName,
                body: messageText,
                icon: photoURL,
              });
            }
          } else {
            // Keep tracked to prevent repeat alerts
            notifiedIdsRef.current.add(msgId);
          }
        });

        // Update document title unread counter when tab is in background or unfocused
        const totalUnread = Object.values(data).reduce(
          (acc, c) => acc + (c?.unread || 0),
          0
        );

        if (
          typeof document !== "undefined" &&
          (document.visibilityState === "hidden" || (typeof document.hasFocus === "function" && !document.hasFocus()))
        ) {
          updateTitleUnread(totalUnread);
        }
      },
      (error) => {
        console.warn("GlobalNotificationListener userChats snapshot error:", error);
      }
    );

    return () => {
      unsub();
    };
  }, [currentUser?.uid]);

  return null;
};

export default GlobalNotificationListener;
