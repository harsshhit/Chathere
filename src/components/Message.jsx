import React, { useContext, useRef, useState, useEffect, memo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import { Download, ZoomIn, Check, CheckCheck, Edit2, Trash2, X, Check as SaveIcon, Clock, AlertCircle, Reply, Smile } from "lucide-react";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";
import { deleteField, doc, FieldPath, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import Avatar from "./Avatar";
import LoveEffect from "./LoveEffect";
import { getLoveMatches, hasLoveMessage } from "../utils/loveDetect";

const playedLoveMessageIds = new Set();

const formatDate = (date) => {
  if (!date) return "";
  try {
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const QuoteBlock = ({ replyTo, isOwn, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="mb-2 block w-full rounded-md border-l-[3px] px-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    style={{
      borderColor: isOwn ? "rgba(255,255,255,0.75)" : "var(--primary-light)",
      background: isOwn ? "rgba(255,255,255,0.12)" : "var(--subtle)",
      color: isOwn ? "rgba(255,255,255,0.92)" : "var(--text-secondary)",
    }}
    aria-label={`Jump to message from ${replyTo.senderName || "User"}`}
  >
    <span className="block truncate text-[11px] font-semibold">{replyTo.senderName || "User"}</span>
    <span
      className="block text-xs leading-snug"
      style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
    >
      {replyTo.type === "image" ? "📷 Photo" : replyTo.type === "gif" ? "GIF" : replyTo.text || "Message"}
    </span>
  </button>
);

const Message = ({ message, lastRead, reactions: messageReactions = {}, isLive = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || "");
  const [savingEdit, setSavingEdit] = useState(false);
  const { currentUser } = useContext(AuthContext);
  const { data, setReplyingTo } = useContext(ChatContext);
  const ref = useRef();
  const reactionPickerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const pointerStartRef = useRef(null);
  const [canHover, setCanHover] = useState(false);
  const [reactionPicker, setReactionPicker] = useState(null);
  const [loveBurstKey, setLoveBurstKey] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const isLoveMessage = hasLoveMessage(message.text || "");
  const loveMatches = isLoveMessage ? getLoveMatches(message.text || "") : [];

  useEffect(() => {
    if (typeof window !== "undefined") setCanHover(window.matchMedia("(hover: hover)").matches);
  }, []);

  useEffect(() => {
    if (!reactionPicker) return undefined;
    const handleOutsidePointer = (event) => {
      if (!reactionPickerRef.current?.contains(event.target)) setReactionPicker(null);
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setReactionPicker(null);
    };
    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [reactionPicker]);

  useEffect(() => () => clearTimeout(longPressTimerRef.current), []);

  useEffect(() => {
    if (!message.id || !isLive || !isLoveMessage || shouldReduceMotion) return;
    const timestamp = message.date?.toMillis
      ? message.date.toMillis()
      : message.date instanceof Date
        ? message.date.getTime()
        : typeof message.date === "number"
          ? message.date
          : 0;
    if (!timestamp || Date.now() - timestamp > 8000 || playedLoveMessageIds.has(message.id)) return;
    playedLoveMessageIds.add(message.id);
    setLoveBurstKey((key) => key + 1);
  }, [isLive, isLoveMessage, message.date, message.id, shouldReduceMotion]);

  const isOwn = message.senderId === currentUser.uid;

  const handleReply = () => {
    if (!message.id) return;
    const type = message.type === "image" ? "image" : message.type === "gif" || message.img ? "gif" : "text";
    setReplyingTo({
      id: message.id,
      senderId: message.senderId || "",
      senderName: message.senderName || (isOwn ? currentUser.displayName : "User") || "User",
      text: message.text || "",
      type,
    });
  };

  const handleQuoteClick = () => {
    const target = document.getElementById(`msg-${message.replyTo?.id}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    const previousOutline = target.style.outline;
    const previousOutlineOffset = target.style.outlineOffset;
    target.style.transition = "outline-color 180ms ease";
    target.style.outline = "3px solid rgba(99,102,241,0.6)";
    target.style.outlineOffset = "2px";
    window.setTimeout(() => {
      target.style.outline = previousOutline;
      target.style.outlineOffset = previousOutlineOffset;
    }, 1200);
  };

  const openReactionPicker = (anchor) => {
    const rect = anchor?.getBoundingClientRect() || ref.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 236;
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8));
    const top = rect.top >= 58 ? rect.top - 52 : Math.min(rect.bottom + 8, window.innerHeight - 52);
    setReactionPicker({ left, top });
  };

  const handleReaction = async (emoji) => {
    setReactionPicker(null);
    if (!data.chatId || !message.id || !currentUser?.uid) return;
    const chatRef = doc(db, "chats", data.chatId);
    const existingEmoji = messageReactions?.[currentUser.uid];
    try {
      await updateDoc(
        chatRef,
        new FieldPath("reactions", message.id, currentUser.uid),
        existingEmoji === emoji ? deleteField() : emoji
      );
    } catch (error) {
      if (error.code === "not-found") {
        console.warn("Cannot react: chat document is missing.");
      } else {
        console.error("Error updating reaction:", error);
      }
    }
  };

  const reactionCounts = Object.entries(messageReactions || {}).reduce((counts, [uid, emoji]) => {
    if (typeof emoji === "string") {
      counts[emoji] ||= { count: 0, includesMe: false };
      counts[emoji].count += 1;
      if (uid === currentUser.uid) counts[emoji].includesMe = true;
    }
    return counts;
  }, {});

  const startLongPress = (event) => {
    if (canHover || event.pointerType === "mouse") return;
    const anchor = event.currentTarget;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      openReactionPicker(anchor);
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
    }, 400);
  };

  const cancelLongPressOnMove = (event) => {
    const start = pointerStartRef.current;
    if (start && (Math.abs(event.clientX - start.x) > 10 || Math.abs(event.clientY - start.y) > 10)) {
      clearTimeout(longPressTimerRef.current);
      pointerStartRef.current = null;
    }
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimerRef.current);
    pointerStartRef.current = null;
  };

  const renderLoveText = () => {
    if (!loveMatches.length) return message.text;
    const content = [];
    let cursor = 0;
    loveMatches.forEach((match, index) => {
      if (match.index > cursor) content.push(message.text.slice(cursor, match.index));
      content.push(
        <span key={`${match.index}-${index}`} className={shouldReduceMotion ? "love-word-static" : "love-word-pulse"}>
          {match.text}
        </span>
      );
      cursor = match.index + match.text.length;
    });
    if (cursor < message.text.length) content.push(message.text.slice(cursor));
    return content;
  };

  let isRead = false;
  if (isOwn && lastRead && message.status !== "sending") {
    const msgTime = message.date?.toMillis
      ? message.date.toMillis()
      : (message.date instanceof Date
        ? message.date.getTime()
        : (typeof message.date === "number" ? message.date : Date.now()));
    if (msgTime > 0) {
      if (data.user?.isGroup && data.user?.members) {
        isRead = data.user.members.some(
          (m) => m.uid !== currentUser.uid && (lastRead[m.uid] || 0) >= msgTime
        );
      } else {
        isRead = (lastRead[data.user?.uid] || 0) >= msgTime;
      }
    }
  }

  const handleSaveEdit = async () => {
    if (!editText.trim() || editText === message.text) {
      setIsEditing(false);
      return;
    }
    setSavingEdit(true);
    try {
      const chatRef = doc(db, "chats", data.chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const msgs = chatSnap.data().messages || [];
        const updated = msgs.map((m) =>
          m.id === message.id ? { ...m, text: editText.trim(), editedAt: Date.now() } : m
        );
        await updateDoc(chatRef, { messages: updated });
      }
      setIsEditing(false);
    } catch (err) {
      console.error("Error editing message:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this message?")) return;
    try {
      const chatRef = doc(db, "chats", data.chatId);
      const chatSnap = await getDoc(chatRef);
      if (chatSnap.exists()) {
        const msgs = chatSnap.data().messages || [];
        const updated = msgs.filter((m) => m.id !== message.id);
        await updateDoc(chatRef, { messages: updated });
      }
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      if (message.img.startsWith("http") && !message.img.includes("firebasestorage")) {
        const link = document.createElement("a");
        link.href = message.img;
        link.setAttribute("download", `chat-image-${message.id || Date.now()}.gif`);
        link.setAttribute("target", "_blank");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const storage = getStorage();
        const imageRef = storageRef(storage, message.img);
        const url = await getDownloadURL(imageRef);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `chat-image-${message.id || Date.now()}.jpg`);
        link.setAttribute("target", "_blank");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error downloading image:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <motion.div
      ref={ref}
      id={message.id ? `msg-${message.id}` : undefined}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex items-end gap-2.5 mb-3 group relative ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      <Avatar
        src={isOwn ? currentUser.photoURL : (message.senderPhoto || data.user.photoURL)}
        alt={isOwn ? currentUser.displayName : (message.senderName || data.user.displayName)}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-1"
        style={{ border: "1.5px solid rgba(99,102,241,0.3)" }}
      />

      <div className={`flex flex-col gap-1.5 max-w-[72%] sm:max-w-[65%] ${isOwn ? "items-end" : "items-start"}`}>
        {!isOwn && data.user?.isGroup && (
          <span className="text-[10px] text-[var(--text-secondary)] font-medium pl-1">
            {message.senderName || "Unknown"}
          </span>
        )}

        <div className="relative w-full">
          {!canHover && !isEditing && (
            <div
              className={`pointer-events-none absolute left-2 top-1/2 z-0 -translate-y-1/2 rounded-full p-2 text-indigo-500 ${isOwn ? "left-auto right-2" : ""}`}
              aria-hidden="true"
            >
              <Reply size={16} />
            </div>
          )}
        <motion.div
          drag={!canHover && !isEditing ? "x" : false}
          dragConstraints={{ left: 0, right: 70 }}
          dragElastic={0.12}
          dragSnapToOrigin
          dragDirectionLock
          style={{ touchAction: "pan-y", userSelect: "text", position: "relative", zIndex: 1 }}
          onDragEnd={(_, info) => {
            if (info.offset.x >= 50) handleReply();
          }}
          onPointerDown={startLongPress}
          onPointerMove={cancelLongPressOnMove}
          onPointerUp={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onClick={() => {
            if (isLoveMessage && !shouldReduceMotion) setLoveBurstKey((key) => key + 1);
          }}
        >
        {isEditing ? (
          <div className="flex items-center gap-1.5 bg-[var(--surface-3)] p-1.5 rounded-xl border border-indigo-500/50">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              className="bg-transparent text-sm text-[var(--text-primary)] outline-none px-2 py-1 flex-1"
              autoFocus
            />
            <button
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
              aria-label="Save edit"
            >
              <SaveIcon size={14} />
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="p-1 rounded-lg bg-[var(--surface-4)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="Cancel edit"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          message.text && (
            <motion.div
              animate={loveBurstKey ? { scale: [1, 1.06, 1] } : { scale: 1 }}
              transition={{ duration: 0.34, ease: "easeOut" }}
              className={`relative px-3.5 py-2.5 text-sm leading-relaxed ${
                isOwn ? "msg-bubble-sent" : "msg-bubble-received"
              } ${isLoveMessage ? "love-message-bubble" : ""}`}
              style={{ maxWidth: "100%", wordBreak: "break-word" }}
            >
              {message.replyTo && <QuoteBlock replyTo={message.replyTo} isOwn={isOwn} onClick={handleQuoteClick} />}
              {renderLoveText()}
              <span
                className="flex items-center gap-1 justify-end text-[10px] mt-1"
                style={{ color: isOwn ? "rgba(255,255,255,0.85)" : "var(--bubble-received-meta)" }}
              >
                {message.editedAt && <span className="italic mr-0.5">(edited)</span>}
                {formatDate(message.date)}
                {isOwn && (
                  message.status === "sending" ? (
                    <Clock size={12} className="opacity-75 inline-block" aria-label="Sending" />
                  ) : message.status === "failed" ? (
                    <AlertCircle size={13} className="text-red-300 inline-block" aria-label="Failed to send" title="Failed to send" />
                  ) : isRead ? (
                    <CheckCheck size={14} style={{ color: "#bae6fd" }} aria-label="Read" />
                  ) : (
                    <Check size={14} aria-label="Sent" />
                  )
                )}
              </span>
            </motion.div>
          )
        )}

        {message.img && (
          <motion.div
            className="relative cursor-pointer overflow-hidden rounded-2xl group"
            onClick={() => setIsExpanded(!isExpanded)}
            animate={{ width: isExpanded ? "100%" : "auto" }}
            transition={{ duration: 0.3 }}
          >
            {!message.text && message.replyTo && (
              <div className="absolute left-2 right-2 top-2 z-10">
                <QuoteBlock replyTo={message.replyTo} isOwn={isOwn} onClick={handleQuoteClick} />
              </div>
            )}
            <img
              src={message.img}
              alt="attachment"
              className={`rounded-2xl object-cover transition-all duration-300 ${
                isExpanded ? "max-h-[60vh] w-full object-contain" : "max-h-[200px] max-w-[260px]"
              }`}
              style={{
                border: "1px solid var(--border)",
                boxShadow: "0 8px 32px var(--shadow)",
              }}
              onError={(e) => {
                // Replace broken GIF (e.g. old Tenor URLs) with a friendly placeholder
                e.currentTarget.onerror = null;
                e.currentTarget.style.display = "none";
                const placeholder = document.createElement("div");
                placeholder.style.cssText =
                  "display:flex;align-items:center;justify-content:center;padding:12px 16px;border-radius:12px;font-size:11px;color:var(--text-muted);background:var(--surface-3);border:1px solid var(--border);min-width:120px;text-align:center;";
                placeholder.textContent = "GIF unavailable";
                e.currentTarget.parentNode?.insertBefore(placeholder, e.currentTarget.nextSibling);
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 rounded-2xl flex items-center justify-center">
              <ZoomIn
                size={22}
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              />
            </div>

            <span
              className="absolute bottom-2 right-2 text-[10px] text-white px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            >
              {message.editedAt && <span className="italic mr-0.5">(edited)</span>}
              {formatDate(message.date)}
              {isOwn && (
                message.status === "sending" ? (
                  <Clock size={11} className="opacity-75 inline-block" aria-label="Sending" />
                ) : message.status === "failed" ? (
                  <AlertCircle size={12} className="text-red-300 inline-block" aria-label="Failed to send" title="Failed to send" />
                ) : isRead ? (
                  <CheckCheck size={12} className="text-blue-300 opacity-90" />
                ) : (
                  <Check size={12} className="opacity-80" />
                )
              )}
            </span>

            {isExpanded && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
                onClick={handleDownload}
                disabled={isDownloading}
                className="absolute bottom-3 left-3 p-2.5 rounded-xl transition-all duration-200 disabled:opacity-50"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                }}
              >
                <Download size={16} className={isDownloading ? "animate-pulse" : ""} />
              </motion.button>
            )}
          </motion.div>
        )}
        </motion.div>
        {loveBurstKey > 0 && (
          <div key={loveBurstKey} className="pointer-events-none absolute inset-0 z-30">
            <LoveEffect />
          </div>
        )}
        {Object.entries(reactionCounts).length > 0 && (
          <div className={`flex flex-wrap gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactionCounts).map(([emoji, reaction]) => (
              <motion.button
                key={emoji}
                type="button"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                onClick={() => handleReaction(emoji)}
                className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                style={{
                  background: reaction.includesMe ? "rgba(99,102,241,0.18)" : "var(--surface-2)",
                  borderColor: reaction.includesMe ? "var(--primary-light)" : "var(--border-light)",
                  color: "var(--text-primary)",
                }}
                aria-label={`${emoji}, ${reaction.count} reactions${reaction.includesMe ? ", remove your reaction" : ", add your reaction"}`}
              >
                <span>{emoji}</span><span>{reaction.count}</span>
              </motion.button>
            ))}
          </div>
        )}
        </div>
      </div>

      {!isEditing && message.status !== "sending" && (
        <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 flex items-center gap-1 mb-1">
          <button
            type="button"
            onClick={(event) => openReactionPicker(event.currentTarget)}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary-light)] hover:bg-[var(--hover)] transition-colors focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
            title="React"
            aria-label="Add a reaction"
          >
            <Smile size={14} />
          </button>
          <button
            type="button"
            onClick={handleReply}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary-light)] hover:bg-[var(--hover)] transition-colors focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-indigo-500"
            title="Reply"
            aria-label="Reply to message"
          >
            <Reply size={14} />
          </button>
          {isOwn && (
            <>
          {message.text && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary-light)] hover:bg-[var(--hover)] transition-colors"
              title="Edit message"
              aria-label="Edit message"
            >
              <Edit2 size={13} />
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger-text)] hover:bg-[var(--hover)] transition-colors"
            title="Delete message"
            aria-label="Delete message"
          >
            <Trash2 size={13} />
          </button>
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {reactionPicker && (
          <motion.div
            ref={reactionPickerRef}
            initial={{ opacity: 0, scale: 0.85, y: 5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 5 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="fixed z-[70] flex items-center justify-between gap-1 rounded-full border px-2 py-1.5 shadow-xl"
            style={{ left: reactionPicker.left, top: reactionPicker.top, width: 236, background: "var(--surface-2)", borderColor: "var(--border-light)", boxShadow: "0 10px 35px var(--shadow)" }}
            role="group"
            aria-label="Quick reactions"
          >
            {["❤️", "😂", "😮", "😢", "👍", "🙏"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(emoji)}
                className="rounded-full p-1.5 text-lg leading-none transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const sameObject = (left = {}, right = {}) => {
  const leftKeys = Object.keys(left || {});
  const rightKeys = Object.keys(right || {});
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => left[key] === right[key]);
};

const sameDate = (left, right) => {
  if (left === right) return true;
  const leftTime = left?.toMillis ? left.toMillis() : left instanceof Date ? left.getTime() : left;
  const rightTime = right?.toMillis ? right.toMillis() : right instanceof Date ? right.getTime() : right;
  return leftTime === rightTime;
};

const areMessagePropsEqual = (previous, next) => {
  const previousMessage = previous.message || {};
  const nextMessage = next.message || {};
  const sameReply = sameObject(previousMessage.replyTo, nextMessage.replyTo);
  return previousMessage.id === nextMessage.id &&
    previousMessage.text === nextMessage.text &&
    previousMessage.img === nextMessage.img &&
    previousMessage.type === nextMessage.type &&
    previousMessage.senderId === nextMessage.senderId &&
    previousMessage.senderName === nextMessage.senderName &&
    previousMessage.senderPhoto === nextMessage.senderPhoto &&
    previousMessage.editedAt === nextMessage.editedAt &&
    previousMessage.status === nextMessage.status &&
    sameDate(previousMessage.date, nextMessage.date) &&
    sameReply &&
    previous.isLive === next.isLive &&
    sameObject(previous.lastRead, next.lastRead) &&
    sameObject(previous.reactions, next.reactions);
};

export default memo(Message, areMessagePropsEqual);
