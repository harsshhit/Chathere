import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useContext, useEffect, useState, useRef, useCallback } from "react";
import { ChatContext } from "../context/ChatContext";
import { AuthContext } from "../context/AuthContext";
import { db } from "../firebase";
import Message from "./Message";
import { showNotification, requestNotificationPermission } from "../utils/notifications";
import { motion } from "framer-motion";

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState({});
  const [lastRead, setLastRead] = useState({});
  const { data } = useContext(ChatContext);
  const { currentUser } = useContext(AuthContext);
  const messagesEndRef = useRef(null);
  const previousMessagesLength = useRef(0);

  const markAsReadIfFocused = useCallback((newMessages, currentLastRead) => {
    if (document.hasFocus() && newMessages.length > 0 && data.chatId) {
      const latestMsg = newMessages[newMessages.length - 1];
      if (latestMsg.senderId !== currentUser.uid) {
        const myLastRead = currentLastRead?.[currentUser.uid];
        const latestMsgTime = latestMsg.date?.toMillis ? latestMsg.date.toMillis() : Date.now();
        if (!myLastRead || myLastRead < latestMsgTime) {
          updateDoc(doc(db, "chats", data.chatId), {
            [`lastRead.${currentUser.uid}`]: Date.now()
          }).catch(console.error);
        }
      }
    }
  }, [data.chatId, currentUser.uid]);

  useEffect(() => {
    requestNotificationPermission();

    const unSub = onSnapshot(doc(db, "chats", data.chatId), (documentSnapshot) => {
      if (documentSnapshot.exists()) {
        const docData = documentSnapshot.data();
        const newMessages = docData.messages || [];
        const currentLastRead = docData.lastRead || {};
        
        setMessages(newMessages);
        setTyping(docData.typing || {});
        setLastRead(currentLastRead);

        if (newMessages.length > previousMessagesLength.current && !document.hasFocus()) {
          const latestMessage = newMessages[newMessages.length - 1];
          if (latestMessage.senderId !== data.user.uid) {
            showNotification(data.user.displayName || "New Message", {
              body: latestMessage.text || (latestMessage.img ? "Sent an image" : "New message received"),
              tag: "new-message",
              renotify: true,
            });
          }
        }
        previousMessagesLength.current = newMessages.length;
        
        markAsReadIfFocused(newMessages, currentLastRead);
      }
    });

    return () => unSub();
  }, [data.chatId, data.user.uid, data.user.displayName, currentUser.uid, markAsReadIfFocused]);

  useEffect(() => {
    const handleFocus = () => {
      markAsReadIfFocused(messages, lastRead);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [messages, lastRead, markAsReadIfFocused]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  return (
    <div
      className="h-full overflow-y-auto px-4 py-5 space-y-1 custom-scrollbar"
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
          <Message key={m.id || index} message={m} lastRead={lastRead} />
        ))
      )}
      
      {/* Typing Indicator */}
      {Object.entries(typing)
        .filter(([uid, isTyping]) => isTyping && uid !== currentUser.uid)
        .map(([uid]) => (
          <div key={uid} className="flex items-end gap-2.5 mb-3 px-2 mt-2">
            <div className="flex bg-[var(--surface-3)] px-4 py-2.5 rounded-full items-center gap-1.5" style={{border: "1px solid var(--border)"}}>
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{background: "var(--primary-light)"}} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{background: "var(--primary-light)"}} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{background: "var(--primary-light)"}} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
            </div>
          </div>
        ))}
        
      <div ref={messagesEndRef} />
    </div>
  );
};

export default Messages;
