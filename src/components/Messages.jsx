import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useContext, useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import { ChatContext } from "../context/ChatContext";
import { AuthContext } from "../context/AuthContext";
import { db } from "../firebase";
import Message from "./Message";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState({});
  const [lastRead, setLastRead] = useState({});
  const { data } = useContext(ChatContext);
  const { currentUser } = useContext(AuthContext);

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  const previousMessagesLength = useRef(0);
  const isInitialLoad = useRef(true);
  const initialScrollComplete = useRef(false);
  const wasNearBottomRef = useRef(true);
  const loadedChatId = useRef(data?.chatId || null);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const isHoveringRef = useRef(false);
  const isAutoScrollingRef = useRef(false);

  const markAsReadIfFocused = useCallback((newMessages, currentLastRead) => {
    const isVisible = typeof document === "undefined" || document.visibilityState === "visible";
    if (isVisible && newMessages.length > 0 && data.chatId) {
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

  // Jump scroll instantly to the bottom without animation
  const scrollToBottomInstant = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, []);

  useEffect(() => {
    if (!data.chatId) return;

    // Reset scroll tracking and message state when switching chats
    if (loadedChatId.current !== data.chatId) {
      isInitialLoad.current = true;
      initialScrollComplete.current = false;
      wasNearBottomRef.current = true;
      previousMessagesLength.current = 0;
      loadedChatId.current = data.chatId;
      setMessages([]);
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
        previousMessagesLength.current = newMessages.length;

        markAsReadIfFocused(newMessages, currentLastRead);
      }
    });

    return () => unSub();
  }, [data.chatId, currentUser.uid, markAsReadIfFocused]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        markAsReadIfFocused(messages, lastRead);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [messages, lastRead, markAsReadIfFocused]);

  // Check if user is scrolled near bottom (within 120px)
  const isNearBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= 120;
  }, []);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom <= 120;
    wasNearBottomRef.current = atBottom;

    // Suppress scroll button while initializing / first scroll to bottom
    if (isInitialLoad.current || !initialScrollComplete.current) return;

    if (atBottom) {
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
    wasNearBottomRef.current = true;
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

  // Synchronous pre-paint jump to bottom when messages first load in DOM
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    if (!initialScrollComplete.current && messages.length > 0) {
      scrollToBottomInstant();
    }
  }, [messages, scrollToBottomInstant]);

  // Ensure bottom focus on chat opening, settle initial load, and handle incoming messages
  useEffect(() => {
    if (!containerRef.current) return;

    if (!initialScrollComplete.current) {
      if (messages.length > 0) {
        scrollToBottomInstant();
        const rafId = requestAnimationFrame(() => {
          scrollToBottomInstant();
        });
        const timer = setTimeout(() => {
          scrollToBottomInstant();
          initialScrollComplete.current = true;
          isInitialLoad.current = false;
        }, 200);

        return () => {
          cancelAnimationFrame(rafId);
          clearTimeout(timer);
        };
      }
    } else {
      // Subsequent messages after initial load:
      const latestMessage = messages[messages.length - 1];
      const isSentByMe = latestMessage && latestMessage.senderId === currentUser.uid;

      if (isSentByMe || isNearBottom()) {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  }, [messages, typing, currentUser?.uid, isNearBottom, scrollToBottomInstant]);

  // Keep bottom focus pinned as media/images or dynamic content render
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (!initialScrollComplete.current || wasNearBottomRef.current) {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }
    });

    observer.observe(contentEl);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Handle mobile keyboard opening & viewport resizing:
  // Scroll message list to bottom (instant, only if user was already near bottom)
  useEffect(() => {
    const handleViewportOrFocus = () => {
      if (wasNearBottomRef.current || isNearBottom()) {
        scrollToBottomInstant();
        requestAnimationFrame(() => {
          if (wasNearBottomRef.current || isNearBottom()) {
            scrollToBottomInstant();
          }
        });
        setTimeout(() => {
          if (wasNearBottomRef.current || isNearBottom()) {
            scrollToBottomInstant();
          }
        }, 100);
        setTimeout(() => {
          if (wasNearBottomRef.current || isNearBottom()) {
            scrollToBottomInstant();
          }
        }, 300);
      }
    };

    const handleFocusIn = (e) => {
      if (
        e.target &&
        (e.target.id === "chat-message-input" ||
          e.target.tagName === "INPUT" ||
          e.target.tagName === "TEXTAREA")
      ) {
        handleViewportOrFocus();
      }
    };

    if (typeof window !== "undefined") {
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", handleViewportOrFocus);
      }
      window.addEventListener("resize", handleViewportOrFocus);
      document.addEventListener("focusin", handleFocusIn);
    }

    return () => {
      if (typeof window !== "undefined") {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener("resize", handleViewportOrFocus);
        }
        window.removeEventListener("resize", handleViewportOrFocus);
        document.removeEventListener("focusin", handleFocusIn);
      }
    };
  }, [isNearBottom, scrollToBottomInstant]);

  return (
    <div className="relative flex-1 min-h-0 w-full h-full overflow-hidden flex flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-5 custom-scrollbar overscroll-contain"
        style={{ background: "var(--surface)", overscrollBehavior: "contain" }}
      >
        <div ref={contentRef} className="space-y-1 min-h-full flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
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
                <div
                  className="flex bg-[var(--surface-3)] px-4 py-2.5 rounded-full items-center gap-1.5"
                  style={{ border: "1px solid var(--border)" }}
                >
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--primary-light)" }}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                  />
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--primary-light)" }}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                  />
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "var(--primary-light)" }}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                  />
                </div>
              </div>
            ))}

          <div ref={messagesEndRef} />
        </div>
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
