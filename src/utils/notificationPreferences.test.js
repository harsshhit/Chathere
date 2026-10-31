const {
  getNotificationBody,
  getRecipientNotificationSettings,
} = require("../../api/notificationPreferences");

describe("push notification preferences", () => {
  it("defaults to private previews and no vibration until preferences are synced", () => {
    expect(getRecipientNotificationSettings()).toEqual({
      showPreview: false,
      vibrate: false,
    });
    expect(getNotificationBody("Secret message", false)).toBe("New message received");
  });

  it("applies a recipient's saved preview and vibration choices", () => {
    const settings = getRecipientNotificationSettings({
      notificationSettings: { showPreview: true, vibrate: true },
    });

    expect(settings).toEqual({ showPreview: true, vibrate: true });
    expect(getNotificationBody("Hello", settings.showPreview)).toBe("Hello");
  });

  it("limits preview content to Firebase's data payload length", () => {
    expect(getNotificationBody("x".repeat(150), true)).toHaveLength(120);
    expect(getNotificationBody(null, true)).toBe("New message received");
  });
});
