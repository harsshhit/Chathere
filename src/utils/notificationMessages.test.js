import {
  getNewIncomingMessages,
  getNotificationMessageId,
  isNotificationSnapshotReady,
  seedNotificationMessageIds,
  shouldNotifyForIncomingMessage,
} from "./notificationMessages";

describe("notification message tracking", () => {
  it("waits for the authenticated user's first Firestore snapshot", () => {
    expect(isNotificationSnapshotReady("user-1", null)).toBe(false);
    expect(isNotificationSnapshotReady("user-2", "user-1")).toBe(false);
    expect(isNotificationSnapshotReady("user-1", "user-1")).toBe(true);
  });

  it("uses the stable message ID when available", () => {
    expect(getNotificationMessageId("chat-1", { id: "message-1" })).toBe("message-1");
  });

  it("creates a stable fallback ID for Firestore timestamps", () => {
    const message = {
      date: { seconds: 123, toMillis: () => 123000 },
      senderId: "sender-1",
      text: "hello",
    };
    expect(getNotificationMessageId("chat-1", message)).toBe("chat-1_123000_sender-1_hello");
    expect(getNotificationMessageId("chat-1", { ...message, date: { seconds: 123 } })).toBe(
      "chat-1_123000_sender-1_hello"
    );
  });

  it("seeds the first loaded snapshot without treating history as new", () => {
    const seenIds = new Map();
    const chats = { "chat-1": { lastMessage: { id: "old-message", senderId: "other" } } };

    seedNotificationMessageIds(chats, seenIds);
    expect(getNewIncomingMessages(chats, "me", seenIds)).toEqual([]);
  });

  it("returns each new incoming message once and ignores messages sent by the user", () => {
    const seenIds = new Map();
    const chats = {
      "chat-incoming": { lastMessage: { id: "incoming", senderId: "other", text: "hello" } },
      "chat-own": { lastMessage: { id: "own", senderId: "me", text: "sent" } },
    };

    expect(getNewIncomingMessages(chats, "me", seenIds)).toHaveLength(1);
    expect(getNewIncomingMessages(chats, "me", seenIds)).toEqual([]);
  });

  it("only displays foreground notifications for an unfocused conversation", () => {
    const eligible = {
      chatId: "other-chat",
      activeChatId: "active-chat",
      isHidden: false,
      isFocused: true,
      now: 1000,
    };

    expect(shouldNotifyForIncomingMessage(eligible)).toBe(true);
    expect(shouldNotifyForIncomingMessage({ ...eligible, chatId: "active-chat" })).toBe(false);
    expect(shouldNotifyForIncomingMessage({ ...eligible, isHidden: true })).toBe(false);
    expect(shouldNotifyForIncomingMessage({ ...eligible, isFocused: false })).toBe(false);
    expect(shouldNotifyForIncomingMessage({ ...eligible, mutedUntil: 1001 })).toBe(false);
  });
});
