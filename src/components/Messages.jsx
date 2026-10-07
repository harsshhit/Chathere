import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useContext, useEffect, useState, useRef, useCallback } from "react";
import { ChatContext } from "../context/ChatContext";
import { AuthContext } from "../context/AuthContext";
import { db } from "../firebase";
import Message from "./Message";
import { showNotification, requestNotificationPermission } from "../utils/notifications";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState({});
  const [lastRead, setLastRead] = useState({});
  const { data } = useContext(ChatContext);
  const { currentUser } = useContext(AuthContext);
  const messagesEndRef = useRef(null);
  const previousMessagesLength = useRef(0);
  // Track whether this is the initial load for the current chat (instant scroll vs smooth)
  const isInitialLoad = useRef(true);
  // Track the chatId that was loaded to detect chat switches
  const loadedChatId = useRef(null);

  const containerRef = useRef(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const isHoveringRef = useRef(false);
  const isAutoScrollingRef = useRef(false);

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

    if (!data.chatId) return;

    // Reset scroll tracking when switching chats
    if (loadedChatId.current !== data.chatId) {
      isInitialLoad.current = true;
      previousMessagesLength.current = 0;
      loadedChatId.current = data.chatId;
      setShowScrollBottom(false);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    }

    const unSub = onSnapshot(doc(db, "chats", data.chatId), (documentSnapshot) => {
      if (documentSnapshot.exists()) {
        const docData = documentSnapshot.data();
        const newMessages = docData.messages || [];
        const currentLastRead = docData.lastRead || {};

        setMessages(newMessages);
        setTyping(docData.typing || {});
        setLastRead(currentLastRead);

        if (newMessages.length > previousMessagesLength.current) {
          const latestMessage = newMessages[newMessages.length - 1];
          if (latestMessage && latestMessage.senderId !== currentUser.uid && !document.hasFocus()) {
            showNotification(data.user?.displayName || "New Message", {
              body: latestMessage.text || (latestMessage.img ? "Sent an image" : "New message received"),
              tag: data.chatId,
            });
          }
        }
        previousMessagesLength.current = newMessages.length;

        markAsReadIfFocused(newMessages, currentLastRead);
      }
    });

    return () => unSub();
  }, [data.chatId, data.user?.displayName, currentUser.uid, markAsReadIfFocused]);

  useEffect(() => {
    const handleFocus = () => {
      markAsReadIfFocused(messages, lastRead);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [messages, lastRead, markAsReadIfFocused]);

  // Check if user is scrolled near bottom (within 120px)
  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= 120;
  }, []);

  const handleScroll = useCallback(() => {
    if (isInitialLoad.current) return;
    const el = containerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const notAtBottom = distanceFromBottom > 120;

    if (!notAtBottom) {
      isAutoScrollingRef.current = false;
      setShowScrollBottom(false);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
      return;
    }

    // Skip showing if user triggered smooth scroll to bottom
    if (isAutoScrollingRef.current) {
      return;
    }

    setShowScrollBottom(true);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      if (!isHoveringRef.current) {
        setShowScrollBottom(false);
      }
    }, 3000);
  }, []);

  const scrollToBottom = useCallback(() => {
    isAutoScrollingRef.current = true;
    setShowScrollBottom(false);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }

    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    } else if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }

    setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 800);
  }, []);

  const handleMouseEnter = useCallback(() => {
    isHoveringRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    const el = containerRef.current;
    if (el) {
      const notAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight > 120;
      if (notAtBottom) {
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          setShowScrollBottom(false);
        }, 3000);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Scroll to bottom: instant on initial load, smooth only for new messages when user is already near bottom
  useEffect(() => {
    if (!messagesEndRef.current) return;

    if (isInitialLoad.current) {
      // First render of this chat — jump instantly so there's no scroll animation on mount
      if (containerRef.current) {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      } else {
        messagesEndRef.current.scrollIntoView({ behavior: "auto" });
      }
      isInitialLoad.current = false;
    } else {
      // Subsequent messages — smooth scroll only if user is already near the bottom
      if (isNearBottom()) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages, typing, isNearBottom]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-5 space-y-1 custom-scrollbar overscroll-contain"
        style={{ background: "var(--surface)", overscrollBehavior: "contain" }}
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

        {Object.entries(typing)
          .filter(([uid, isTyping]) => isTyping && uid !== currentUser.uid)
          .map(([uid]) => (
            <div key={uid} className="flex items-end gap-2.5 mb-3 px-2 mt-2">
              <div className="flex bg-[var(--surface-3)] px-4 py-2.5 rounded-full items-center gap-1.5" style={{ border: "1px solid var(--border)" }}>
                <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--primary-light)" }} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--primary-light)" }} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--primary-light)" }} animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
              </div>
            </div>
          ))}

        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {showScrollBottom && (
          <motion.button
            type="button"
            onClick={scrollToBottom}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            aria-label="Scroll to bottom"
            className="absolute bottom-4 right-4 z-20 flex items-center justify-center w-9 h-9 rounded-full cursor-pointer group"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border-light)",
              boxShadow: "0 4px 16px var(--shadow), 0 0 0 1px var(--glass-inset) inset",
              color: "var(--text-secondary)",
              touchAction: "manipulation",
            }}
          >
            <ChevronDown
              size={18}
              strokeWidth={2.4}
              className="group-hover:text-[var(--primary)] transition-colors duration-150"
            />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Messages;
