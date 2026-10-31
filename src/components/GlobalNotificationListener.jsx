import { useContext, useEffect, useRef } from "react";
import { useLocation, matchPath } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import {
  ChatContext,
  UserChatsContext,
  UserChatsLoadedContext,
  UserDocumentContext,
  UserDocumentLoadedContext,
} from "../context/ChatContexts";
import { notifyMessage, saveNotificationSettings, updateTitleUnread } from "../utils/notify";
import {
  getNewIncomingMessages,
  isNotificationSnapshotReady,
  seedNotificationMessageIds,
  shouldNotifyForIncomingMessage,
} from "../utils/notificationMessages";

const GlobalNotificationListener = () => {
  const { currentUser } = useContext(AuthContext);
  const { data: chatContextData } = useContext(ChatContext);
  const userChats = useContext(UserChatsContext);
  const userChatsLoadedUid = useContext(UserChatsLoadedContext);
  const userDocument = useContext(UserDocumentContext);
  const userDocumentLoadedUid = useContext(UserDocumentLoadedContext);
  const chatPrefsRef = useRef(userDocument.chatPrefs || {});
  const location = useLocation();

  const match = matchPath("/chat/:chatId", location.pathname);
  const activeChatId = match?.params?.chatId || chatContextData?.chatId || null;
  const activeChatIdRef = useRef(activeChatId);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  useEffect(() => {
    chatPrefsRef.current =
      userDocumentLoadedUid === currentUser?.uid ? userDocument.chatPrefs || {} : {};
  }, [currentUser?.uid, userDocument.chatPrefs, userDocumentLoadedUid]);

  useEffect(() => {
    if (currentUser?.uid && userDocumentLoadedUid === currentUser.uid && userDocument.notificationSettings) {
      saveNotificationSettings(userDocument.notificationSettings);
    }
  }, [currentUser?.uid, userDocument.notificationSettings, userDocumentLoadedUid]);

  const notifiedIdsRef = useRef(new Map());
  const initializedUidRef = useRef(null);
  const registeredPushUidRef = useRef(null);
  const currentUserId = currentUser?.uid;

  useEffect(() => {
    if (!currentUserId) {
      registeredPushUidRef.current = null;
      return undefined;
    }

    let active = true;
    const syncPushToken = async () => {
      if (
        registeredPushUidRef.current === currentUserId ||
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
      ) return;

      registeredPushUidRef.current = currentUserId;
      try {
        const { registerPushToken } = await import("../utils/pushToken");
        if (active) await registerPushToken({ uid: currentUserId });
      } catch (error) {
        registeredPushUidRef.current = null;
        console.warn("Could not register push token:", error);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void syncPushToken();
    };

    void syncPushToken();
    window.addEventListener("focus", syncPushToken);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.removeEventListener("focus", syncPushToken);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [currentUserId]);

  useEffect(() => {
    const handleFocus = () => updateTitleUnread(0);
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
    initializedUidRef.current = null;
    notifiedIdsRef.current = new Map();
    if (!currentUserId) updateTitleUnread(0);
  }, [currentUserId]);

  useEffect(() => {
    if (!isNotificationSnapshotReady(currentUserId, userChatsLoadedUid)) return;
    const data = userChats || {};

    if (initializedUidRef.current !== currentUserId) {
      seedNotificationMessageIds(data, notifiedIdsRef.current);
      initializedUidRef.current = currentUserId;
    } else {
      const newMessages = getNewIncomingMessages(data, currentUserId, notifiedIdsRef.current);
      newMessages.forEach(({ chatId, chat, message }) => {
        const isDocHidden =
          typeof document !== "undefined" &&
          (document.hidden || document.visibilityState === "hidden");
        const isWindowUnfocused =
          typeof document !== "undefined" &&
          typeof document.hasFocus === "function" &&
          !document.hasFocus();
        if (shouldNotifyForIncomingMessage({
          chatId,
          activeChatId: activeChatIdRef.current,
          isHidden: isDocHidden,
          isFocused: !isWindowUnfocused,
          mutedUntil: chatPrefsRef.current?.[chatId]?.mutedUntil,
        })) {
          void notifyMessage({
            chatId,
            title: message.senderName || chat.userInfo?.displayName || "New Message",
            body: message.text || "Sent a message",
            icon: chat.userInfo?.photoURL || "/icon-192.png",
          });
        }
      });
    }

    const totalUnread = Object.values(data).reduce(
      (acc, chat) => acc + (Number(chat?.unread) || 0),
      0
    );
    if (
      typeof document !== "undefined" &&
      (document.visibilityState === "hidden" ||
        (typeof document.hasFocus === "function" && !document.hasFocus()))
    ) {
      updateTitleUnread(totalUnread);
    }
  }, [currentUserId, userChats, userChatsLoadedUid]);

  return null;
};

export default GlobalNotificationListener;
