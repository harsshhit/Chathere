import { useSyncExternalStore } from "react";

// In-memory cache for optimistic/pending messages keyed by chatId
// Format: { [chatId]: [ { id, text, img, date, senderId, senderName, senderPhoto, status } ] }
let pendingByChat = {};
const listeners = new Set();
const EMPTY_ARRAY = [];

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error("Error in pendingMessages listener:", e);
    }
  });
};

export const pendingMessagesStore = {
  getMessages: (chatId) => {
    if (!chatId || !pendingByChat[chatId] || pendingByChat[chatId].length === 0) {
      return EMPTY_ARRAY;
    }
    return pendingByChat[chatId];
  },

  addMessage: (chatId, message) => {
    if (!chatId || !message) return;
    const current = pendingByChat[chatId] || [];
    pendingByChat = {
      ...pendingByChat,
      [chatId]: [...current, message],
    };
    notifyListeners();
  },

  removeMessage: (chatId, messageId) => {
    if (!chatId || !pendingByChat[chatId]) return;
    const current = pendingByChat[chatId];
    const filtered = current.filter((m) => m.id !== messageId);
    if (filtered.length === current.length) return;

    if (filtered.length === 0) {
      const next = { ...pendingByChat };
      delete next[chatId];
      pendingByChat = next;
    } else {
      pendingByChat = {
        ...pendingByChat,
        [chatId]: filtered,
      };
    }
    notifyListeners();
  },

  updateMessageStatus: (chatId, messageId, status) => {
    if (!chatId || !pendingByChat[chatId]) return;
    let changed = false;
    const nextList = pendingByChat[chatId].map((m) => {
      if (m.id === messageId && m.status !== status) {
        changed = true;
        return { ...m, status };
      }
      return m;
    });

    if (changed) {
      pendingByChat = {
        ...pendingByChat,
        [chatId]: nextList,
      };
      notifyListeners();
    }
  },

  clearChat: (chatId) => {
    if (!chatId || !pendingByChat[chatId]) return;
    const next = { ...pendingByChat };
    delete next[chatId];
    pendingByChat = next;
    notifyListeners();
  },

  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const usePendingMessages = (chatId) => {
  return useSyncExternalStore(
    pendingMessagesStore.subscribe,
    () => pendingMessagesStore.getMessages(chatId)
  );
};
