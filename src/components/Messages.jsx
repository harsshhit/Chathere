import { doc, onSnapshot } from "firebase/firestore";
import React, { useContext, useEffect, useState, useRef } from "react";
import { ChatContext } from "../context/ChatContext";
import { db } from "../firebase";
import Message from "./Message";
import { showNotification, requestNotificationPermission } from "../utils/notifications";

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const { data } = useContext(ChatContext);
  const messagesEndRef = useRef(null);
  const previousMessagesLength = useRef(0);

  useEffect(() => {
    requestNotificationPermission();

    const unSub = onSnapshot(doc(db, "chats", data.chatId), (doc) => {
      if (doc.exists()) {
        const newMessages = doc.data().messages;
        setMessages(newMessages);

        if (newMessages.length > previousMessagesLength.current && !document.hasFocus()) {
          const latestMessage = newMessages[newMessages.length - 1];
          if (latestMessage.senderId !== data.user.uid) {
            showNotification(data.user.displayName || "New Message", {
              body: latestMessage.text || "New message received",
              tag: "new-message",
              renotify: true,
            });
          }
        }
        previousMessagesLength.current = newMessages.length;
      }
    });

    return () => unSub();
  }, [data.chatId, data.user.uid, data.user.displayName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      className="h-full overflow-y-auto px-4 py-5 space-y-1"
      style={{ background: "var(--surface)" }}
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            No messages yet — say hello! 👋
          </p>
        </div>
      ) : (
        messages.map((m, index) => (
          <Message key={m.id || index} message={m} />
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default Messages;
