const listeners = new Map();
const messageSnapshots = new Map();

export const getChatMessages = (chatId) => messageSnapshots.get(chatId) || [];

export const publishChatMessages = (chatId, messages) => {
  if (!chatId) return;
  messageSnapshots.set(chatId, messages);
  listeners.get(chatId)?.forEach((listener) => listener());
};

export const subscribeChatMessages = (chatId, listener) => {
  if (!chatId) return () => {};
  const chatListeners = listeners.get(chatId) || new Set();
  chatListeners.add(listener);
  listeners.set(chatId, chatListeners);
  return () => {
    chatListeners.delete(listener);
    if (chatListeners.size === 0) listeners.delete(chatId);
  };
};