import { doc, FieldPath, onSnapshot, updateDoc } from "firebase/firestore";
import React, { memo, useContext, useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from "react";
import { ChatContext } from "../context/ChatContexts";
import { AuthContext } from "../context/AuthContext";
import { db } from "../firebase";
import Message from "./Message";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { usePendingMessages, pendingMessagesStore } from "../utils/pendingMessages";
import { publishChatMessages } from "../utils/chatMessagesStore";
import { formatDayLabel } from "../utils/formatters";
import { ScrollRootProvider } from "../context/ScrollRootContext";
import { releaseOwnMediaForChat } from "../utils/ownMediaCache";

const messageTime = (message) => {
  const date = message?.date;
  if (date?.toMillis) return date.toMillis();
  if (date?.seconds) return date.seconds * 1000;
  if (date instanceof Date) return date.getTime();
  return Number(date) || 0;
};

const isVoiceMessage = (message) => Boolean(
  message &&
  message.type !== "deleted" &&
  !message.deleted &&
  !message.deletedAt &&
  (message.type === "audio" || message.audio?.url || message.file?.mime?.startsWith("audio/"))
);

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [messagesError, setMessagesError] = useState("");
  const [reactions, setReactions] = useState({});
  const [liveMessageIds, setLiveMessageIds] = useState(() => new Set());
  const [typing, setTyping] = useState({});
  const [documentVisible, setDocumentVisible] = useState(() => document.visibilityState === "visible");
  const [lastRead, setLastRead] = useState({});
  const { data } = useContext(ChatContext);
  const { currentUser } = useContext(AuthContext);

  const pendingMessages = usePendingMessages(data.chatId);
  useEffect(() => {
    const updateVisibility = () => setDocumentVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);
  useEffect(() => {
    const activeChatId = data.chatId;
    return () => {
      if (activeChatId) releaseOwnMediaForChat(activeChatId);
    };
  }, [data.chatId]);

  // Merge server messages with optimistic pending messages (filter out any already arrived on server)
  const serverMsgIds = useMemo(() => new Set(messages.map((m) => m.id)), [messages]);
  const activePending = useMemo(
    () => pendingMessages.filter((pm) => !serverMsgIds.has(pm.id)),
    [pendingMessages, serverMsgIds]
  );
  const displayMessages = useMemo(
    () => [...messages, ...activePending],
    [messages, activePending]
  );
  const renderEntries = useMemo(() => {
    const entries = [];
    let lastDay = "";
    let index = 0;
    while (index < displayMessages.length) {
      const message = displayMessages[index];
      const timestamp = messageTime(message);
      const day = timestamp ? new Date(timestamp).toDateString() : "";
      if (day && day !== lastDay) {
        entries.push({ type: "date", key: `date-${day}`, label: formatDayLabel(timestamp) });
        lastDay = day;
      }

      const canStack = (candidate) =>
        Boolean(candidate?.img) &&
        candidate.type !== "deleted" &&
        !candidate.deleted &&
        !candidate.deletedAt &&
        !candidate.replyTo;
      if (canStack(message) && timestamp > 0) {
        const stack = [message];
        let nextIndex = index + 1;
        while (nextIndex < displayMessages.length) {
          const next = displayMessages[nextIndex];
          const elapsed = messageTime(next) - messageTime(displayMessages[nextIndex - 1]);
          if (
            !canStack(next) ||
            next.senderId !== message.senderId ||
            elapsed < 0 ||
            elapsed > 90_000
          ) break;
          stack.push(next);
          nextIndex += 1;
        }
        if (stack.length > 1) {
          const previous = displayMessages[index - 1];
          const next = displayMessages[nextIndex];
          const lastStackTime = messageTime(stack[stack.length - 1]);
          const continuesPreviousRun = previous &&
            messageTime(previous) > 0 &&
            timestamp - messageTime(previous) >= 0 &&
            timestamp - messageTime(previous) <= 5 * 60_000 &&
            previous.senderId === message.senderId;
          const continuesNextRun = next &&
            messageTime(next) > 0 &&
            messageTime(next) - lastStackTime >= 0 &&
            messageTime(next) - lastStackTime <= 5 * 60_000 &&
            next.senderId === message.senderId;
          entries.push({
            type: "stack",
            key: `stack-${message.id}`,
            messages: stack,
            showGroupSenderName: Boolean(data.user?.isGroup) && !continuesPreviousRun,
            showGroupAvatar: Boolean(data.user?.isGroup) &&
              !continuesNextRun &&
              message.senderId !== currentUser.uid,
            rowGap: continuesNextRun ? "2px" : "12px",
          });
          index += stack.length;
          continue;
        }
      }

      const previous = displayMessages[index - 1];
      const next = displayMessages[index + 1];
      const messageTimestamp = messageTime(message);
      const samePreviousRun = previous &&
        messageTimestamp > 0 &&
        messageTime(previous) > 0 &&
        previous.senderId === message.senderId &&
        messageTimestamp - messageTime(previous) <= 5 * 60_000;
      const sameNextRun = next &&
        messageTimestamp > 0 &&
        messageTime(next) > 0 &&
        next.senderId === message.senderId &&
        messageTime(next) - messageTime(message) <= 5 * 60_000;
      entries.push({
        type: "message",
        key: message.id || index,
        message,
        nextVoiceMessage: isVoiceMessage(message) &&
          isVoiceMessage(next) &&
          next.senderId === message.senderId
          ? next
          : null,
        showGroupSenderName: Boolean(data.user?.isGroup) && !samePreviousRun,
        showGroupAvatar: Boolean(data.user?.isGroup) && !sameNextRun && message.senderId !== currentUser.uid,
        rowGap: sameNextRun ? "2px" : "12px",
      });
      index += 1;
    }
    return entries;
  }, [displayMessages, data.user?.isGroup, currentUser.uid]);
  const priorityImageKeys = new Set(
    renderEntries
      .filter((entry) => entry.type === "stack" || Boolean(entry.message?.img))
      .slice(-2)
      .map((entry) => entry.key)
  );

  useEffect(() => {
    publishChatMessages(data.chatId, displayMessages);
  }, [data.chatId, displayMessages]);

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  const previousMessagesLength = useRef(0);
  const isInitialLoad = useRef(true);
  const initialScrollComplete = useRef(false);
  const wasNearBottomRef = useRef(true);
  const loadedChatId = useRef(data?.chatId || null);
  const observedMessageIdsRef = useRef(new Set());
  const hasInitialSnapshotRef = useRef(false);

  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadBelow, setUnreadBelow] = useState(0);
  const scrollTimeoutRef = useRef(null);
  const isHoveringRef = useRef(false);
  const isAutoScrollingRef = useRef(false);
  const lastReadWriteRef = useRef({ chatId: null, lastWriteAt: 0 });

  const markAsReadIfFocused = useCallback((newMessages, currentLastRead) => {
    const isVisible = typeof document === "undefined" || document.visibilityState === "visible";
    if (isVisible && newMessages.length > 0 && data.chatId) {
      const latestMsg = newMessages[newMessages.length - 1];
      if (latestMsg.senderId !== currentUser.uid) {
        const myLastRead = currentLastRead?.[currentUser.uid];
        const latestMsgTime = messageTime(latestMsg) || Date.now();
        const lastReadTime = messageTime({ date: myLastRead });
        const now = Date.now();
        if (lastReadWriteRef.current.chatId !== data.chatId) {
          lastReadWriteRef.current = { chatId: data.chatId, lastWriteAt: 0 };
        }
        if (
          lastReadTime < latestMsgTime &&
          now - lastReadWriteRef.current.lastWriteAt >= 2000
        ) {
          lastReadWriteRef.current.lastWriteAt = now;
          updateDoc(
            doc(db, "chats", data.chatId),
            new FieldPath("lastRead", currentUser.uid),
            now
          ).catch((error) => {
            if (lastReadWriteRef.current.chatId === data.chatId) {
              lastReadWriteRef.current.lastWriteAt = 0;
            }
            console.error("Could not update last-read state:", error);
          });
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
      lastReadWriteRef.current = { chatId: data.chatId, lastWriteAt: 0 };
      setMessages([]);
      setMessagesError("");
      setReactions({});
      setLiveMessageIds(new Set());
      observedMessageIdsRef.current = new Set();
      hasInitialSnapshotRef.current = false;
      setShowScrollBottom(false);
      setUnreadBelow(0);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    }

    const unSub = onSnapshot(doc(db, "chats", data.chatId), (documentSnapshot) => {
      setMessagesError("");
      if (documentSnapshot.exists()) {
        const docData = documentSnapshot.data();
        const newMessages = docData.messages || [];
        const currentLastRead = docData.lastRead || {};

        const currentIds = new Set(newMessages.map((message) => message.id).filter(Boolean));
        if (hasInitialSnapshotRef.current) {
          const arrivedIds = [...currentIds].filter((id) => !observedMessageIdsRef.current.has(id));
          if (arrivedIds.length > 0) {
            setLiveMessageIds((existing) => new Set([...existing, ...arrivedIds]));
            if (!wasNearBottomRef.current) {
              const incomingCount = newMessages.filter(
                (message) => arrivedIds.includes(message.id) && message.senderId !== currentUser.uid
              ).length;
              if (incomingCount) setUnreadBelow((count) => count + incomingCount);
            }
          }
        } else {
          hasInitialSnapshotRef.current = true;
        }
        observedMessageIdsRef.current = currentIds;

        setMessages(newMessages);
        setReactions(docData.reactions || {});
        setTyping(docData.typing || {});
        setLastRead(currentLastRead);
        previousMessagesLength.current = newMessages.length;

        // Clean up any pending messages that are now confirmed in Firestore
        if (data.chatId && newMessages.length > 0) {
          newMessages.forEach((m) => {
            if (m?.id) {
              pendingMessagesStore.removeMessage(data.chatId, m.id);
            }
          });
        }

        markAsReadIfFocused(newMessages, currentLastRead);
      } else {
        setMessages([]);
        setReactions({});
        setTyping({});
        setLastRead({});
      }
    }, (error) => {
      console.error("Chat messages snapshot error:", error);
      setMessagesError("Messages could not be loaded. Check your connection and try again.");
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
      setUnreadBelow(0);
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
    if (!initialScrollComplete.current && displayMessages.length > 0) {
      scrollToBottomInstant();
    }
  }, [displayMessages, scrollToBottomInstant]);

  // Ensure bottom focus on chat opening, settle initial load, and handle incoming messages
  useEffect(() => {
    if (!containerRef.current) return;

    if (!initialScrollComplete.current) {
      if (displayMessages.length > 0) {
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
      const latestMessage = displayMessages[displayMessages.length - 1];
      const isSentByMe = latestMessage && latestMessage.senderId === currentUser.uid;

      if (isSentByMe || isNearBottom()) {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
  }, [displayMessages, typing, currentUser?.uid, isNearBottom, scrollToBottomInstant]);

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
    <ScrollRootProvider rootRef={containerRef}>
    <div className="relative flex-1 min-h-0 w-full h-full overflow-hidden flex flex-col">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="ember-bg flex-1 min-h-0 overflow-y-auto px-4 py-5 custom-scrollbar overscroll-contain"
        style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
      >
        <div ref={contentRef} className="min-h-full flex flex-col">
          {messagesError && (
            <p role="alert" className="mb-3 text-center text-sm text-[var(--danger-text)]">
              {messagesError}
            </p>
          )}
          {displayMessages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No messages yet — say hello! 👋
              </p>
            </div>
          ) : (
            renderEntries.map((entry) => {
              if (entry.type === "date") {
                return (
                  <div key={entry.key} className="chat-date-separator">
                    {entry.label}
                  </div>
                );
              }
              if (entry.type === "stack") {
                const stackMessages = entry.messages;
                const lastImage = stackMessages[stackMessages.length - 1];
                return (
                  <Message
                    key={entry.key}
                    message={stackMessages[0]}
                    photoStack={stackMessages}
                    photoStackLastMessage={lastImage}
                    lastRead={lastRead}
                    reactions={reactions?.[lastImage.id] || {}}
                    isLive={stackMessages.some((item) => item.status === "sending" || liveMessageIds.has(item.id))}
                    showGroupSenderName={entry.showGroupSenderName}
                    showGroupAvatar={entry.showGroupAvatar}
                    rowGap={entry.rowGap}
                    priority={priorityImageKeys.has(entry.key)}
                  />
                );
              }
              return (
                <Message
                  key={entry.key}
                  message={entry.message}
                  lastRead={lastRead}
                  reactions={reactions?.[entry.message.id] || {}}
                  isLive={entry.message.status === "sending" || liveMessageIds.has(entry.message.id)}
                  nextVoiceMessage={entry.nextVoiceMessage}
                  showGroupSenderName={entry.showGroupSenderName}
                  showGroupAvatar={entry.showGroupAvatar}
                  rowGap={entry.rowGap}
                  priority={priorityImageKeys.has(entry.key)}
                />
              );
            })
          )}

          {Object.entries(typing)
            .filter(([uid, isTyping]) => isTyping && uid !== currentUser.uid)
            .map(([uid]) => (
              <div key={uid} className="flex items-end gap-2.5 mb-3 px-2 mt-2">
                <div className="msg-bubble-received flex items-center gap-1.5 rounded-full px-4 py-2.5">
                  <motion.div
                    className="typing-dot"
                    animate={documentVisible ? { y: [0, -4, 0] } : { y: 0 }}
                    transition={{ repeat: documentVisible ? Infinity : 0, duration: 0.6, delay: 0 }}
                  />
                  <motion.div
                    className="typing-dot"
                    animate={documentVisible ? { y: [0, -4, 0] } : { y: 0 }}
                    transition={{ repeat: documentVisible ? Infinity : 0, duration: 0.6, delay: 0.2 }}
                  />
                  <motion.div
                    className="typing-dot"
                    animate={documentVisible ? { y: [0, -4, 0] } : { y: 0 }}
                    transition={{ repeat: documentVisible ? Infinity : 0, duration: 0.6, delay: 0.4 }}
                  />
                </div>
              </div>
            ))}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <AnimatePresence>
        {showScrollBottom && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-4 right-4 z-20"
          >
            <button
              type="button"
              onClick={scrollToBottom}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              aria-label="Scroll to bottom"
              className="glass icon-btn-glass relative h-10 w-10 cursor-pointer group"
            >
              <ChevronDown
                size={18}
                strokeWidth={2.4}
                className="group-hover:text-[var(--primary)] transition-colors duration-150"
              />
              {unreadBelow > 0 && (
                <span className="scroll-unread-count">{unreadBelow}</span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </ScrollRootProvider>
  );
};

export default memo(Messages);
