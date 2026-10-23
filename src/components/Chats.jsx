import { deleteField, doc, FieldPath, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useContext, useEffect, useState, useRef, memo, useCallback } from "react";
import {
  MessageCircle,
  Archive,
  ArchiveRestore,
  MoreVertical,
  Pin,
  BellOff,
  Bell,
  Check,
  CheckCheck,
  FileText,
  Film,
  Image as ImageIcon,
  Mic,
  Users,
} from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { ChatContext, UserDocumentContext } from "../context/ChatContext";
import { db } from "../firebase";
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
  onMenuOpen,
  preference,
  canHover,
  staggerDelay,
  currentUserUid,
}) {
  const pressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const lastMessage = chat.lastMessage;
  const muted = preference.mutedUntil > Date.now();
  const typing = Object.entries(chat.typing || {}).some(
    ([uid, isTyping]) => uid !== currentUserUid && isTyping
  );
  const presence = chat.userInfo?.presence;
  const isOnline = chat.userInfo?.online === true || presence === "online";
  const messageTime = lastMessage?.date?.seconds
    ? lastMessage.date.seconds * 1000
    : Number(lastMessage?.date || 0);
  const readTimes = Object.entries(chat.lastRead || chat.readReceipts || {})
    .filter(([uid]) => uid !== currentUserUid)
    .map(([, timestamp]) => Number(timestamp?.seconds ? timestamp.seconds * 1000 : timestamp));
  const isRead = Boolean(
    lastMessage?.read ||
    lastMessage?.status === "read" ||
    (messageTime && readTimes.some((timestamp) => timestamp >= messageTime))
  );
  const previewIcon = lastMessage?.type === "image" || lastMessage?.img
    ? ImageIcon
    : lastMessage?.type === "gif"
    ? Film
    : lastMessage?.file?.mime?.startsWith("audio/")
    ? Mic
    : lastMessage?.file
    ? FileText
    : null;
  const PreviewIcon = previewIcon;
  const handleSelect = () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onSelect(chat.userInfo, chatId);
  };

  return (
    <motion.div
      key={chatId}
      role="button"
      tabIndex={0}
      aria-label={`${chat.userInfo?.displayName || "Chat"}${hasUnread ? `, ${unreadCount} unread` : ""}`}
      aria-current={isActive ? "true" : undefined}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      transition={{ delay: staggerDelay, duration: 0.2 }}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(chat.userInfo, chatId);
        }
      }}
      onContextMenu={(event) => { event.preventDefault(); onMenuOpen(event, chatId); }}
      onPointerDown={(event) => {
        if (event.pointerType !== "touch") return;
        const element = event.currentTarget;
        pressTimer.current = window.setTimeout(() => {
          longPressTriggered.current = true;
          onMenuOpen({ currentTarget: element, stopPropagation: () => {} }, chatId);
        }, 550);
      }}
      onPointerUp={() => window.clearTimeout(pressTimer.current)}
      onPointerCancel={() => window.clearTimeout(pressTimer.current)}
      className={`row flex min-h-[72px] items-center gap-3 rounded-2xl px-3 py-2.5 cursor-pointer group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${isActive ? "chat-row-active" : ""}`}
      style={{
        background: isActive
          ? "var(--glass-bg)"
          : "transparent",
        border: isActive ? "1px solid var(--border-strong)" : "1px solid transparent",
        touchAction: "manipulation",
      }}
      whileHover={
        canHover
          ? {
              backgroundColor: isActive ? "var(--glass-bg)" : "var(--hover)",
            }
          : undefined
      }
    >
      <div className="relative flex-shrink-0">
        <Avatar
          src={chat.userInfo?.photoURL}
          alt={chat.userInfo?.displayName}
          className="h-[52px] w-[52px] rounded-full"
          style={{
            border: "1px solid var(--border-strong)",
          }}
        />
        {isOnline && (
          <span className="avatar-dot-online absolute bottom-0 right-0" aria-label="Online" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex min-w-0 items-center gap-1.5">
          <span
            className={`truncate text-base leading-5 text-[var(--text-primary)] ${
              hasUnread
                ? "font-bold"
                : "font-semibold"
            }`}
          >
            {chat.userInfo?.displayName}
          </span>
        </div>

        <p className={`flex min-w-0 items-center gap-1 truncate text-sm leading-5 ${hasUnread ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
          {typing ? (
            <span className="truncate font-medium text-[var(--primary-text)]">typing…</span>
          ) : (
            <>
              {isOwnLastMsg && <span className="shrink-0">You:</span>}
              {isOwnLastMsg && (
                isRead
                  ? <CheckCheck size={16} className="shrink-0 text-[var(--seen)]" aria-label="Read" />
                  : <Check size={15} className="shrink-0 text-[var(--text-muted)]" aria-label="Sent" />
              )}
              {PreviewIcon && <PreviewIcon size={15} className="shrink-0 text-[var(--text-muted)]" />}
              <span className="truncate">
                {lastMessage?.text || (lastMessage ? "Sent an attachment" : "Start a conversation")}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex w-[68px] flex-shrink-0 flex-col items-end justify-center gap-1">
        <span className="text-xs leading-4 text-[var(--text-muted)]">
          {formattedDate}
        </span>
        <div className="flex h-5 items-center gap-1.5">
          {preference.pinned && <Pin size={13} className="text-[var(--text-muted)]" aria-label="Pinned chat" />}
          {muted && <BellOff size={13} className="text-[var(--text-muted)]" aria-label="Muted chat" />}
          {hasUnread && <span className="badge-unread">{unreadCount}</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-center">
        <button
          type="button"
          onClick={(event) => onMenuOpen(event, chatId)}
          onContextMenu={(event) => { event.preventDefault(); onMenuOpen(event, chatId); }}
          className="rounded-full p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100"
          title="Chat options"
          aria-label={`Options for ${chat.userInfo?.displayName || "chat"}`}
          aria-haspopup="menu"
        >
          <MoreVertical size={16} />
        </button>
      </div>
    </motion.div>
  );
});

const Chats = () => {
  const [chats, setChats] = useState({});
  const [filter, setFilter] = useState("all");
  const [canHover, setCanHover] = useState(false);
  const [menu, setMenu] = useState(null);

  const { currentUser } = useContext(AuthContext);
  const { dispatch, data: activeChatData } = useContext(ChatContext);
  const userDocument = useContext(UserDocumentContext);
  const navigate = useNavigate();
  const { chatId: routeChatId } = useParams();

  const scrollContainerRef = useRef(null);
  const isFirstRender = useRef(true);

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

  useEffect(() => {
    const openArchived = () => setFilter("archived");
    window.addEventListener("chathere:show-archived", openArchived);
    return () => window.removeEventListener("chathere:show-archived", openArchived);
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsub = onSnapshot(doc(db, "userChats", currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        setChats(docSnap.data() || {});
      } else {
        setChats({});
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

  const saveChatPreference = useCallback(
    async (chatId, key, value) => {
      try {
        await updateDoc(doc(db, "users", currentUser.uid), new FieldPath("chatPrefs", chatId, key), value);
      } catch (err) {
        console.error("Error saving chat preference:", err);
      }
    },
    [currentUser?.uid]
  );

  const handleMenuOpen = useCallback((event, chatId) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setMenu({ chatId, x: Math.min(rect.left, window.innerWidth - 220), y: Math.min(rect.bottom, window.innerHeight - 260) });
  }, []);

  const handlePreference = useCallback(async (key, value) => {
    if (!menu?.chatId) return;
    const chatId = menu.chatId;
    setMenu(null);
    await saveChatPreference(chatId, key, value);
  }, [menu, saveChatPreference]);

  const handleMute = useCallback(async (duration) => {
    if (!menu?.chatId) return;
    const chatId = menu.chatId;
    setMenu(null);
    try {
      const value = duration === "off" ? deleteField() : duration === "always" ? 9999999999999 : Date.now() + duration;
      await updateDoc(doc(db, "users", currentUser.uid), new FieldPath("chatPrefs", chatId, "mutedUntil"), value);
    } catch (err) {
      console.error("Error saving mute preference:", err);
    }
  }, [currentUser?.uid, menu]);

  const handlePin = useCallback(async () => {
    if (!menu?.chatId) return;
    const chatId = menu.chatId;
    const isPinned = Boolean(userDocument.chatPrefs?.[chatId]?.pinned);
    if (!isPinned && Object.values(userDocument.chatPrefs || {}).filter((item) => item?.pinned).length >= 3) {
      window.alert("You can pin up to 3 chats.");
      setMenu(null);
      return;
    }
    setMenu(null);
    await saveChatPreference(chatId, "pinned", !isPinned);
  }, [menu, saveChatPreference, userDocument.chatPrefs]);

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

  const preferences = userDocument.chatPrefs || {};
  const orderedChats = sortedChats.sort(([chatIdA], [chatIdB]) => Number(Boolean(preferences[chatIdB]?.pinned)) - Number(Boolean(preferences[chatIdA]?.pinned)));
  const unarchivedChats = orderedChats.filter(([chatId]) => !preferences[chatId]?.archived);
  const archivedChats = orderedChats.filter(([chatId]) => preferences[chatId]?.archived);
  const unreadChats = unarchivedChats.filter(([, chat]) => (chat.unread || 0) > 0);
  const groupChats = unarchivedChats.filter(([, chat]) => chat.userInfo?.isGroup);
  const pinnedChats = unarchivedChats.filter(([chatId]) => preferences[chatId]?.pinned);
  const displayedChats = filter === "archived"
    ? archivedChats
    : filter === "unread"
    ? unreadChats
    : filter === "groups"
    ? groupChats
    : filter === "pinned"
    ? pinnedChats
    : unarchivedChats;
  const filterOptions = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread", count: unreadChats.length },
    { id: "groups", label: "Groups" },
    { id: "pinned", label: "Pinned" },
    { id: "archived", label: "Archived", count: archivedChats.length },
  ];
  const emptyState = {
    all: ["No conversations yet", "Search for someone to start chatting."],
    unread: ["All caught up", "New unread messages will appear here."],
    groups: ["No group chats yet", "Create a group to bring people together."],
    pinned: ["No pinned chats", "Pin a chat from its options menu to keep it here."],
    archived: ["No archived chats", "Archived conversations will appear here."],
  }[filter];

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
      data-main-scroll
      className="flex-1 overflow-y-auto pb-28 pt-1 flex flex-col overscroll-contain md:pb-4"
      style={{ background: "transparent", overscrollBehavior: "contain" }}
    >
      <div className="filter-chip-scroll mx-4 mb-2 flex gap-2">
        {filterOptions.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            aria-pressed={filter === id}
            className={`chip shrink-0 transition-colors ${filter === id ? "chip-active" : ""}`}
          >
            {label}
            {count > 0 && <span className="text-[11px] opacity-75">{count}</span>}
          </button>
        ))}
      </div>

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
              className="glass mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            >
              {filter === "archived" ? (
                <Archive size={28} style={{ color: "var(--text-muted)" }} />
              ) : filter === "groups" ? (
                <Users size={28} style={{ color: "var(--text-muted)" }} />
              ) : (
                <MessageCircle size={28} style={{ color: "var(--text-muted)" }} />
              )}
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              {emptyState[0]}
            </p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {emptyState[1]}
            </p>
          </motion.div>
        ) : (
          <motion.div key={`chat-list-${filter}`} layout className="space-y-1 px-3 pb-4">
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
                  onMenuOpen={handleMenuOpen}
                  preference={preferences[chatId] || {}}
                  canHover={canHover}
                  staggerDelay={staggerDelay}
                  currentUserUid={currentUser?.uid}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      {menu && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close chat options" onClick={() => setMenu(null)} />
          <div role="menu" aria-label="Chat options" className="fixed z-50 w-52 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1 shadow-xl" style={{ left: menu.x, top: menu.y }}>
            <button role="menuitem" className="menu-row" onClick={handlePin}><Pin size={15} />{preferences[menu.chatId]?.pinned ? "Unpin chat" : "Pin chat"}</button>
            <button role="menuitem" className="menu-row" onClick={() => handlePreference("archived", !preferences[menu.chatId]?.archived)}>{preferences[menu.chatId]?.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}{preferences[menu.chatId]?.archived ? "Unarchive" : "Archive"}</button>
            {preferences[menu.chatId]?.mutedUntil > Date.now() ? (
              <button role="menuitem" className="menu-row" onClick={() => handleMute("off")}><Bell size={15} />Unmute</button>
            ) : (
              <div className="relative group/mute">
                <button role="menuitem" className="menu-row w-full"><BellOff size={15} />Mute for...<span className="ml-auto">›</span></button>
                <div className="absolute left-full top-0 hidden w-36 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1 shadow-xl group-hover/mute:block focus-within:block">
                  <button role="menuitem" className="menu-row" onClick={() => handleMute(8 * 60 * 60 * 1000)}>8 hours</button>
                  <button role="menuitem" className="menu-row" onClick={() => handleMute(7 * 24 * 60 * 60 * 1000)}>1 week</button>
                  <button role="menuitem" className="menu-row" onClick={() => handleMute("always")}>Always</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      <style>{`.menu-row{display:flex;align-items:center;gap:.65rem;width:100%;padding:.55rem .65rem;border-radius:.4rem;text-align:left;font-size:.82rem;color:var(--text-primary)}.menu-row:hover,.menu-row:focus-visible{background:var(--hover);outline:none}`}</style>
    </div>
  );
};

export default memo(Chats);
