import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import React, { useContext, useEffect, useState, useRef, memo } from "react";
import { MessageCircle, Archive, ArchiveRestore, ChevronLeft } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import { db } from "../firebase";
import { useUI } from "../context/UIContext";
import { showNotification, updateTitleUnread } from "../utils/notifications";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "./Avatar";

const Chats = () => {
  const [chats, setChats] = useState({});
  const [activeChat, setActiveChat] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const { currentUser } = useContext(AuthContext);
  const { dispatch } = useContext(ChatContext);
  const { setIsMobileView } = useUI();
  const prevChatsRef = useRef(null);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsub = onSnapshot(doc(db, "userChats", currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() || {};
        
        if (prevChatsRef.current) {
          Object.entries(data).forEach(([cId, cData]) => {
            const prevChat = prevChatsRef.current[cId];
            const newLastMsg = cData?.lastMessage;
            const prevLastMsg = prevChat?.lastMessage;

            const isNewMessage =
              newLastMsg &&
              newLastMsg.senderId !== currentUser.uid &&
              (!prevLastMsg || prevLastMsg.text !== newLastMsg.text || prevLastMsg.date !== newLastMsg.date);

            if (isNewMessage) {
              const senderName = cData.userInfo?.displayName || "New Message";
              const messageText = newLastMsg.text || "Sent a message";
              showNotification(senderName, {
                body: messageText,
                tag: cId,
              });
            }
          });
        }
        prevChatsRef.current = data;

        setChats(data);
        const totalUnread = Object.values(data).reduce(
          (acc, c) => acc + (c?.unread || 0),
          0
        );
        updateTitleUnread(totalUnread);
      }
    });

    return () => unsub();
  }, [currentUser?.uid]);

  const handleSelect = async (u, chatId) => {
    dispatch({ type: "CHANGE_USER", payload: u });
    setIsMobileView(false);
    setActiveChat(chatId);
    if (chats[chatId]?.unread > 0) {
      try {
        await updateDoc(doc(db, "userChats", currentUser.uid), {
          [`${chatId}.unread`]: 0,
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleArchiveToggle = async (e, chatId, currentStatus) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, "userChats", currentUser.uid), {
        [`${chatId}.isArchived`]: !currentStatus,
      });
    } catch (err) {
      console.error(err);
    }
  };

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

  return (
    <div className="flex-1 overflow-y-auto py-2 flex flex-col" style={{ background: "var(--surface-2)" }}>
      {showArchived && (
        <div className="px-4 py-2 mb-2 flex items-center w-full" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <button 
            onClick={() => setShowArchived(false)} 
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: "var(--primary-light)" }}
          >
            <ChevronLeft size={16} /> Back to Chats
          </button>
        </div>
      )}

      {!showArchived && archivedChats.length > 0 && (
        <div 
          onClick={() => setShowArchived(true)}
          className="flex items-center justify-between px-4 py-3 mx-2 mb-2 rounded-xl cursor-pointer transition-colors duration-200"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <div className="flex items-center gap-3">
            <Archive size={18} style={{ color: "var(--text-muted)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Archived</span>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--surface-3)", color: "var(--primary-light)" }}>{archivedChats.length}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
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
          <motion.div key="chat-list" className="space-y-0.5 px-2 pb-4">
            {displayedChats.map(([chatId, chat], index) => {
              const unreadCount = chat.unread || 0;
              const hasUnread = unreadCount > 0;
              return (
                <motion.div
                  key={chatId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.03, duration: 0.25 }}
                  onClick={() => handleSelect(chat.userInfo, chatId)}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 group relative"
                  style={{
                    background: activeChat === chatId ? "rgba(99,102,241,0.15)" : (hasUnread ? "rgba(99,102,241,0.06)" : "transparent"),
                    borderLeft: activeChat === chatId ? "3px solid var(--primary)" : (hasUnread ? "3px solid var(--primary-light)" : "3px solid transparent"),
                  }}
                  whileHover={{
                    backgroundColor: activeChat === chatId ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="relative flex-shrink-0">
                    <Avatar
                      src={chat.userInfo?.photoURL}
                      alt={chat.userInfo?.displayName}
                      className="w-12 h-12 rounded-2xl"
                      style={{
                        border: hasUnread ? "2px solid var(--primary-light)" : "1.5px solid rgba(99,102,241,0.25)",
                      }}
                    />
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-indigo-500 border-2 border-[var(--surface-2)]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex justify-between items-baseline gap-2 mb-0.5">
                      <span
                        className={`text-sm truncate ${hasUnread ? "font-extrabold text-white" : "font-semibold text-[var(--text-primary)]"}`}
                      >
                        {chat.userInfo?.displayName}
                      </span>
                      {chat.date && (
                        <span className={`text-[10px] flex-shrink-0 ${hasUnread ? "font-bold text-indigo-300" : "text-[var(--text-muted)]"}`}>
                          {formatTimestamp(chat.date)}
                        </span>
                      )}
                    </div>

                    {chat.lastMessage ? (
                      <p className={`text-xs truncate ${hasUnread ? "font-bold text-indigo-200" : "text-[var(--text-muted)]"}`}>
                        {chat.lastMessage.senderId === currentUser.uid && (
                          <span style={{ color: "var(--primary-light)" }}>You: </span>
                        )}
                        {chat.lastMessage.text || "Sent a message"}
                      </p>
                    ) : (
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>Start a conversation</p>
                    )}
                  </div>

                  {hasUnread && (
                    <div className="flex-shrink-0 px-2 py-0.5 text-[11px] font-black rounded-full text-white bg-indigo-600 shadow-md shadow-indigo-600/40 animate-pulse">
                      {unreadCount}
                    </div>
                  )}

                  <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={(e) => handleArchiveToggle(e, chatId, chat.isArchived)}
                      className="p-2 rounded-xl transition-all duration-200"
                      style={{ 
                        background: "rgba(0,0,0,0.5)", 
                        backdropFilter: "blur(4px)",
                        border: "1px solid rgba(255,255,255,0.1)"
                      }}
                      title={chat.isArchived ? "Unarchive chat" : "Archive chat"}
                    >
                      {chat.isArchived ? <ArchiveRestore size={16} className="text-white" /> : <Archive size={16} className="text-white" />}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(Chats);
