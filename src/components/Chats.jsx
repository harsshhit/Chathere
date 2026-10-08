import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useContext, useEffect, useState, useRef, memo, useCallback } from "react";
import { MessageCircle, Archive, ArchiveRestore, ChevronLeft } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import { db } from "../firebase";
import { notifyMessage } from "../utils/notify";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import Avatar from "./Avatar";

// Module-level scroll position cache so scroll position is preserved across navigation
let savedChatListScroll = 0;

const ChatItem = memo(function ChatItem({
  chatId,
  chat,
  isActive,
  hasUnread,
  unreadCount,
  isOwnLastMsg,
  formattedDate,
  onSelect,
  onArchiveToggle,
  canHover,
  staggerDelay,
}) {
  return (
    <motion.div
      key={chatId}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: staggerDelay, duration: 0.2 }}
      onClick={() => onSelect(chat.userInfo, chatId)}
      className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 group relative"
      style={{
        background: isActive
          ? "rgba(99,102,241,0.15)"
          : hasUnread
          ? "rgba(99,102,241,0.06)"
          : "transparent",
        borderLeft: isActive
          ? "3px solid var(--primary)"
          : hasUnread
          ? "3px solid var(--primary-light)"
          : "3px solid transparent",
        touchAction: "manipulation",
      }}
      whileHover={
        canHover
          ? {
              backgroundColor: isActive ? "rgba(99,102,241,0.15)" : "var(--hover)",
            }
          : undefined
      }
      whileTap={{ scale: 0.98 }}
    >
      <div className="relative flex-shrink-0">
        <Avatar
          src={chat.userInfo?.photoURL}
          alt={chat.userInfo?.displayName}
          className="w-12 h-12 rounded-2xl"
          style={{
            border: hasUnread
              ? "2px solid var(--primary-light)"
              : "1.5px solid rgba(99,102,241,0.25)",
          }}
        />
        {hasUnread && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary border-2 border-[var(--surface-2)]" />
        )}
      </div>

      <div className="flex-1 min-w-0 pr-6">
        <div className="flex justify-between items-baseline gap-2 mb-0.5">
          <span
            className={`text-sm truncate ${
              hasUnread
                ? "font-extrabold text-[var(--text-primary)]"
                : "font-semibold text-[var(--text-primary)]"
            }`}
          >
            {chat.userInfo?.displayName}
          </span>
          {formattedDate && (
            <span
              className={`text-[10px] flex-shrink-0 ${
                hasUnread ? "font-bold text-[var(--unread-meta)]" : "text-[var(--text-muted)]"
              }`}
            >
              {formattedDate}
            </span>
          )}
        </div>

        {chat.lastMessage ? (
          <p
            className={`text-xs truncate ${
              hasUnread ? "font-bold text-[var(--unread-text)]" : "text-[var(--text-muted)]"
            }`}
          >
            {isOwnLastMsg && <span style={{ color: "var(--primary-light)" }}>You: </span>}
            {chat.lastMessage.text || "Sent an attachment"}
          </p>
        ) : (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Start a conversation
          </p>
        )}
      </div>

      {hasUnread && (
        <div className="flex-shrink-0 px-2 py-0.5 text-[11px] font-black rounded-full text-white bg-indigo-600 shadow-md shadow-indigo-600/40 animate-pulse">
          {unreadCount}
        </div>
      )}

      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <button
          onClick={(e) => onArchiveToggle(e, chatId, chat.isArchived)}
          className="p-2 rounded-xl transition-all duration-200"
          style={{
            background: "var(--chip-bg)",
            border: "1px solid var(--border-light)",
            color: "var(--text-primary)",
            touchAction: "manipulation",
          }}
          title={chat.isArchived ? "Unarchive chat" : "Archive chat"}
          aria-label={chat.isArchived ? "Unarchive chat" : "Archive chat"}
        >
          {chat.isArchived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
        </button>
      </div>
    </motion.div>
  );
});

const Chats = () => {
  const [chats, setChats] = useState({});
  const [showArchived, setShowArchived] = useState(false);
  const [canHover, setCanHover] = useState(false);

  const { currentUser } = useContext(AuthContext);
  const { dispatch, data: activeChatData } = useContext(ChatContext);
  const navigate = useNavigate();
  const { chatId: routeChatId } = useParams();

  const prevChatsRef = useRef(null);
  const isFirstSnapshot = useRef(true);
  const isFirstRender = useRef(true);
  const notifiedMessageIdsRef = useRef(new Set());
  const scrollContainerRef = useRef(null);

  const currentOpenChatId = activeChatData?.chatId || routeChatId || null;
  const openChatIdRef = useRef(currentOpenChatId);

  useEffect(() => {
    openChatIdRef.current = currentOpenChatId;
  }, [currentOpenChatId]);

  // Check hover capability once on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setCanHover(window.matchMedia("(hover: hover)").matches);
    }
  }, []);

  // Restore scroll position when returning from chat
  useEffect(() => {
    if (scrollContainerRef.current && savedChatListScroll > 0) {
      scrollContainerRef.current.scrollTop = savedChatListScroll;
    }
  }, []);

  const handleScroll = (e) => {
    savedChatListScroll = e.currentTarget.scrollTop;
  };

  // Synchronize document.title with unread count while hidden; reset when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        document.title = "ChatHere";
      } else {
        const totalUnread = Object.values(chats).reduce(
          (acc, c) => acc + (c?.unread || 0),
          0
        );
        if (totalUnread > 0) {
          document.title = `(${totalUnread}) ChatHere`;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [chats]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsub = onSnapshot(doc(db, "userChats", currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() || {};

        // Ignore the initial snapshot load so existing messages do not trigger notifications
        if (isFirstSnapshot.current) {
          isFirstSnapshot.current = false;
          prevChatsRef.current = data;

          // Seed notified IDs set with current snapshot messages
          Object.entries(data).forEach(([cId, cData]) => {
            const msg = cData?.lastMessage;
            if (msg) {
              const msgTime = typeof msg.date === "number"
                ? msg.date
                : msg.date?.toMillis
                ? msg.date.toMillis()
                : msg.date?.seconds
                ? msg.date.seconds * 1000
                : 0;
              const msgId = msg.id || `${cId}_${msgTime}_${msg.senderId}_${msg.text || ""}`;
              notifiedMessageIdsRef.current.add(msgId);
            }
          });

          setChats(data);
          return;
        }

        // Process incoming chat updates
        Object.entries(data).forEach(([cId, cData]) => {
          const newLastMsg = cData?.lastMessage;
          if (!newLastMsg) return;

          const msgTime = typeof newLastMsg.date === "number"
            ? newLastMsg.date
            : newLastMsg.date?.toMillis
            ? newLastMsg.date.toMillis()
            : newLastMsg.date?.seconds
            ? newLastMsg.date.seconds * 1000
            : 0;

          // Ignore messages older than ~30 seconds when reattaching or coming back from background
          const isOlderThan30s = msgTime > 0 && Date.now() - msgTime > 30000;
          const msgId = newLastMsg.id || `${cId}_${msgTime}_${newLastMsg.senderId}_${newLastMsg.text || ""}`;

          const isNotMe = newLastMsg.senderId !== currentUser.uid;
          const isHiddenOrNotCurrentChat =
            (typeof document !== "undefined" && document.visibilityState === "hidden") ||
            cId !== openChatIdRef.current;
          const notYetNotified = !notifiedMessageIdsRef.current.has(msgId);

          if (isNotMe && isHiddenOrNotCurrentChat && notYetNotified && !isOlderThan30s) {
            notifiedMessageIdsRef.current.add(msgId);
            const senderName = cData.userInfo?.displayName || "New Message";
            const messageText = newLastMsg.text || "Sent a message";

            notifyMessage({
              chatId: cId,
              title: senderName,
              body: messageText,
              icon: cData.userInfo?.photoURL || "/icon-192.png",
            });
          } else {
            // Keep tracked to prevent repeat alerts
            notifiedMessageIdsRef.current.add(msgId);
          }
        });

        prevChatsRef.current = data;
        setChats(data);

        // Update document title fallback while hidden
        const totalUnread = Object.values(data).reduce(
          (acc, c) => acc + (c?.unread || 0),
          0
        );
        if (typeof document !== "undefined") {
          if (document.visibilityState === "hidden" && totalUnread > 0) {
            document.title = `(${totalUnread}) ChatHere`;
          } else if (document.visibilityState === "visible") {
            document.title = "ChatHere";
          }
        }
      }
    });

    return () => unsub();
  }, [currentUser?.uid]);

  const handleSelect = useCallback(
    async (u, chatId) => {
      // Save current scroll position
      if (scrollContainerRef.current) {
        savedChatListScroll = scrollContainerRef.current.scrollTop;
      }

      // Derive standard chatId
      const targetChatId = u.isGroup
        ? u.uid
        : currentUser.uid > u.uid
        ? currentUser.uid + u.uid
        : u.uid + currentUser.uid;

      // Prime chat context immediately
      dispatch({ type: "SET_CHAT", payload: { chatId: targetChatId, user: u } });

      // Navigate to URL
      navigate(`/chat/${targetChatId}`);

      if (chats[chatId]?.unread > 0) {
        try {
          await updateDoc(doc(db, "userChats", currentUser.uid), {
            [`${chatId}.unread`]: 0,
          });
        } catch (err) {
          console.error(err);
        }
      }
    },
    [currentUser?.uid, dispatch, navigate, chats]
  );

  const handleArchiveToggle = useCallback(
    async (e, chatId, currentStatus) => {
      e.stopPropagation();
      try {
        await updateDoc(doc(db, "userChats", currentUser.uid), {
          [`${chatId}.isArchived`]: !currentStatus,
        });
      } catch (err) {
        console.error(err);
      }
    },
    [currentUser?.uid]
  );

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    let date;
    if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === "number") {
      date = new Date(timestamp);
    } else {
      return "";
    }
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  };

  const sortedChats = Object.entries(chats || {})
    .filter(([_, chat]) => chat && chat.userInfo)
    .sort((a, b) => {
      const timeA = a[1]?.date?.seconds || a[1]?.lastMessage?.date || 0;
      const timeB = b[1]?.date?.seconds || b[1]?.lastMessage?.date || 0;
      return timeB - timeA;
    });

  const unarchivedChats = sortedChats.filter(([_, chat]) => !chat.isArchived);
  const archivedChats = sortedChats.filter(([_, chat]) => chat.isArchived);
  const displayedChats = showArchived ? archivedChats : unarchivedChats;

  // After first render, disable the staggered entrance delay
  useEffect(() => {
    if (displayedChats.length > 0) {
      isFirstRender.current = false;
    }
  }, [displayedChats.length]);

  const activeChatId = routeChatId || activeChatData?.chatId;

  return (
    <div
      ref={scrollContainerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto py-2 flex flex-col overscroll-contain"
      style={{ background: "var(--surface-2)", overscrollBehavior: "contain" }}
    >
      {showArchived && (
        <div
          className="px-4 py-2 mb-2 flex items-center w-full"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <button
            onClick={() => setShowArchived(false)}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: "var(--primary-light)", touchAction: "manipulation" }}
          >
            <ChevronLeft size={16} /> Back to Chats
          </button>
        </div>
      )}

      {!showArchived && archivedChats.length > 0 && (
        <div
          onClick={() => setShowArchived(true)}
          className="flex items-center justify-between px-4 py-3 mx-2 mb-2 rounded-xl cursor-pointer transition-colors duration-200"
          style={{ background: "var(--subtle)", touchAction: "manipulation" }}
        >
          <div className="flex items-center gap-3">
            <Archive size={18} style={{ color: "var(--text-muted)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Archived
            </span>
          </div>
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "var(--surface-3)", color: "var(--primary-light)" }}
          >
            {archivedChats.length}
          </span>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {displayedChats.length === 0 ? (
          <motion.div
            key="empty-state"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center flex-1 pt-12 px-6 text-center"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
            >
              {showArchived ? (
                <Archive size={28} style={{ color: "var(--text-muted)" }} />
              ) : (
                <MessageCircle size={28} style={{ color: "var(--text-muted)" }} />
              )}
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              {showArchived ? "No archived chats" : "No conversations yet"}
            </p>
            {!showArchived && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Search for someone above to start chatting
              </p>
            )}
          </motion.div>
        ) : (
          <div key="chat-list" className="space-y-0.5 px-2 pb-4">
            {displayedChats.map(([chatId, chat], index) => {
              const unreadCount = chat.unread || 0;
              const hasUnread = unreadCount > 0;
              const isGroup = chat.userInfo?.isGroup;
              const userUid = chat.userInfo?.uid;

              const derivedChatId = isGroup
                ? userUid
                : currentUser?.uid && userUid
                ? currentUser.uid > userUid
                  ? currentUser.uid + userUid
                  : userUid + currentUser.uid
                : chatId;

              const isActive =
                activeChatId === chatId || activeChatId === derivedChatId;

              const staggerDelay =
                isFirstRender.current && index < 10 ? index * 0.025 : 0;

              return (
                <ChatItem
                  key={chatId}
                  chatId={chatId}
                  chat={chat}
                  isActive={isActive}
                  hasUnread={hasUnread}
                  unreadCount={unreadCount}
                  isOwnLastMsg={chat.lastMessage?.senderId === currentUser.uid}
                  formattedDate={formatTimestamp(chat.date)}
                  onSelect={handleSelect}
                  onArchiveToggle={handleArchiveToggle}
                  canHover={canHover}
                  staggerDelay={staggerDelay}
                />
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(Chats);
