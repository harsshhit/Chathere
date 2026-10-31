const getRecipientNotificationSettings = (recipient = {}) => ({
  showPreview: recipient.notificationSettings?.showPreview === true,
  vibrate: recipient.notificationSettings?.vibrate === true,
});

const getNotificationBody = (body, showPreview) => {
  if (!showPreview) return "New message received";

  const text = typeof body === "string" ? body : String(body ?? "");
  const preview = text.slice(0, 120);
  return preview || "New message received";
};

module.exports = { getNotificationBody, getRecipientNotificationSettings };
