export const isNotificationSnapshotReady = (currentUserId, loadedUserId) =>
  Boolean(currentUserId && currentUserId === loadedUserId);

export const shouldNotifyForIncomingMessage = ({
  chatId,
  activeChatId,
  isHidden,
  isFocused,
  mutedUntil,
  now = Date.now(),
}) =>
  chatId !== activeChatId &&
  !isHidden &&
  isFocused &&
  !(Number(mutedUntil) > now);

export const getNotificationMessageId = (chatId, message) => {
  if (message?.id) return String(message.id);

  const date = message?.date;
  const timestamp =
    typeof date === "number"
      ? date
      : typeof date?.toMillis === "function"
      ? date.toMillis()
      : typeof date?.seconds === "number"
      ? date.seconds * 1000
      : 0;
  return `${chatId}_${timestamp}_${message?.senderId || ""}_${message?.text || ""}`;
};

export const seedNotificationMessageIds = (chats, seenIds) => {
  Object.entries(chats || {}).forEach(([chatId, chat]) => {
    if (chat?.lastMessage) {
      seenIds.set(chatId, getNotificationMessageId(chatId, chat.lastMessage));
    }
  });
};

export const getNewIncomingMessages = (chats, currentUserId, seenIds) => {
  const messages = [];

  Object.entries(chats || {}).forEach(([chatId, chat]) => {
    const message = chat?.lastMessage;
    if (!message) return;

    const messageId = getNotificationMessageId(chatId, message);
    if (seenIds.get(chatId) === messageId) return;
    seenIds.set(chatId, messageId);

    if (message.senderId !== currentUserId) {
      messages.push({ chatId, chat, message, messageId });
    }
  });

  return messages;
};
