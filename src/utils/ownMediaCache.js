import { releaseBlobUrl } from "./mediaCache";

const MAX_OWN_MEDIA = 30;
const ownMedia = new Map();

export function rememberOwnMedia(messageId, chatId, blobUrl) {
  if (!messageId || !chatId || !blobUrl?.startsWith("blob:")) return;
  const previous = ownMedia.get(messageId);
  if (previous?.url && previous.url !== blobUrl) releaseBlobUrl(previous.url);
  ownMedia.delete(messageId);
  ownMedia.set(messageId, { chatId, url: blobUrl });
  while (ownMedia.size > MAX_OWN_MEDIA) {
    const [oldestId, oldest] = ownMedia.entries().next().value;
    ownMedia.delete(oldestId);
    releaseBlobUrl(oldest.url);
  }
}

export const getOwnMediaUrl = (messageId) => ownMedia.get(messageId)?.url || "";

export function releaseOwnMediaForChat(chatId) {
  for (const [messageId, entry] of ownMedia) {
    if (entry.chatId !== chatId) continue;
    ownMedia.delete(messageId);
    releaseBlobUrl(entry.url);
  }
}

export function clearOwnMediaCache() {
  for (const { url } of ownMedia.values()) releaseBlobUrl(url);
  ownMedia.clear();
}
