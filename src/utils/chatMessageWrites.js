import {
  doc,
  increment,
  runTransaction,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const CHAT_DOCUMENT_WARNING_BYTES = 850 * 1024;

export const removeUndefinedValues = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "undefined" ? null : removeUndefinedValues(item)
    );
  }
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => typeof item !== "undefined")
      .map(([key, item]) => [key, removeUndefinedValues(item)])
  );
};

export const estimateDocumentBytes = (value) => {
  const serialized = JSON.stringify(value);
  let bytes = 0;
  for (const character of serialized) {
    const codePoint = character.codePointAt(0);
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
};

export const getMessagesToAppend = (currentMessages, candidates) => {
  const currentIds = new Set(currentMessages.map((message) => message?.id).filter(Boolean));
  return candidates.filter((message) => !currentIds.has(message.id));
};

const getUserInfoForMember = (uid, chatUser, sender) => {
  if (chatUser?.isGroup) return removeUndefinedValues(chatUser);
  if (uid === sender.uid) {
    if (!chatUser?.uid) return undefined;
    return removeUndefinedValues({
      uid: chatUser?.uid,
      displayName: chatUser?.displayName,
      photoURL: chatUser?.photoURL,
    });
  }
  return removeUndefinedValues({
    uid: sender.uid,
    displayName: sender.displayName,
    photoURL: sender.photoURL,
  });
};

export const writeChatMessages = async ({
  chatId,
  messages,
  lastMessageText,
  lastMessageType,
  chatUser,
  sender,
}) => {
  if (!chatId || !Array.isArray(messages) || messages.length === 0 || !sender?.uid) {
    throw new Error("A chat, message, and sender are required.");
  }

  const safeMessages = removeUndefinedValues(messages);
  const uniqueMessages = [...new Map(safeMessages.map((message) => [message.id, message])).values()];
  if (uniqueMessages.some((message) => typeof message.id !== "string" || !message.id)) {
    throw new Error("Every chat message must have a stable ID.");
  }

  const participants = chatUser?.isGroup
    ? [...new Set((chatUser.members || []).map((member) => member?.uid).filter(Boolean))]
    : [...new Set([sender.uid, chatUser?.uid].filter(Boolean))];
  if (!participants.includes(sender.uid)) participants.push(sender.uid);

  const chatRef = doc(db, "chats", chatId);
  const userChatRefs = participants.map((uid) => [uid, doc(db, "userChats", uid)]);

  await runTransaction(db, async (transaction) => {
    const chatSnapshot = await transaction.get(chatRef);
    const chatData = chatSnapshot.exists() ? chatSnapshot.data() || {} : {};
    const currentMessages = Array.isArray(chatData.messages) ? chatData.messages : [];
    const messagesToAdd = getMessagesToAppend(currentMessages, uniqueMessages);
    if (messagesToAdd.length === 0) return;

    const nextMessages = [...currentMessages, ...messagesToAdd];
    const estimatedBytes = estimateDocumentBytes({ ...chatData, messages: nextMessages });
    const previousBytes = estimateDocumentBytes(chatData);
    if (
      estimatedBytes >= CHAT_DOCUMENT_WARNING_BYTES &&
      previousBytes < CHAT_DOCUMENT_WARNING_BYTES
    ) {
      console.warn("Chat document is approaching Firestore's 1 MiB limit:", chatId);
    }

    const sentAt = uniqueMessages[uniqueMessages.length - 1].date || Timestamp.now();
    const safeLastMessage = removeUndefinedValues({
      text: lastMessageText || "",
      senderId: sender.uid,
      date: sentAt,
      ...(lastMessageType ? { type: lastMessageType } : {}),
    });

    if (chatSnapshot.exists()) {
      transaction.update(chatRef, { messages: nextMessages });
    } else {
      transaction.set(chatRef, {
        messages: nextMessages,
        typing: {},
        lastRead: {},
      }, { merge: true });
    }

    userChatRefs.forEach(([uid, userChatRef]) => {
      const unread = chatUser?.isGroup
        ? uid === sender.uid ? 0 : increment(1)
        : uid === sender.uid ? undefined : increment(1);
      const entry = removeUndefinedValues({
        userInfo: getUserInfoForMember(uid, chatUser, sender),
        lastMessage: safeLastMessage,
        date: sentAt,
        unread,
      });
      transaction.set(
        userChatRef,
        Object.fromEntries([[chatId, entry]]),
        { merge: true }
      );
    });
  });
};
