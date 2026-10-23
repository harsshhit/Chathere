import React, { useContext, useRef, useState, useEffect, memo, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import { ChatContext, ContactPanelActionsContext } from "../context/ChatContext";
import { Download, ExternalLink, ZoomIn, Check, CheckCheck, Edit2, Trash2, X, Check as SaveIcon, Clock, AlertCircle, Reply, Smile, FileText, Music4, Video } from "lucide-react";
import { deleteField, doc, FieldPath, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import Avatar from "./Avatar";
import LoveEffect from "./LoveEffect";
import { getLoveMatches, hasLoveMessage } from "../utils/loveDetect";
import { optimizeUrl } from "../utils/cloudinary";

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
    className={`message-quote mb-2 block w-full rounded-md border-l-[3px] px-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${isOwn ? "is-own" : ""}`}
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

const Message = ({
  message,
  lastRead,
  reactions: messageReactions = {},
  isLive = false,
  showGroupSenderName = true,
  showGroupAvatar = true,
  rowGap,
  photoStack = [],
  photoStackLastMessage,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || "");
  const [savingEdit, setSavingEdit] = useState(false);
  const { currentUser } = useContext(AuthContext);
  const { data, setReplyingTo, setEditingMessage } = useContext(ChatContext);
  const { openContactPanelUser: openMemberPanel } = useContext(ContactPanelActionsContext);
  const ref = useRef();
  const reactionPickerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const pointerStartRef = useRef(null);
  const galleryPointerRef = useRef(null);
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
  const stackMessages = photoStack.length > 1 ? photoStack : null;
  const displayedStackLast = photoStackLastMessage || message;
  const reactionMessageId = photoStackLastMessage?.id || message.id;
  const visibleStackMessages = stackMessages?.slice(0, 3) || [];
  const closeGallery = useCallback(() => setGalleryIndex(null), []);
  const changeGalleryIndex = useCallback((step) => {
    if (!stackMessages?.length) return;
    setGalleryIndex((index) => (index + step + stackMessages.length) % stackMessages.length);
  }, [stackMessages]);
  const senderMember = data.user?.members?.find((member) => member.uid === message.senderId) || {
    uid: message.senderId,
    displayName: message.senderName,
    photoURL: message.senderPhoto,
  };

  useEffect(() => {
    if (galleryIndex === null || !stackMessages) return undefined;
    const handleGalleryKey = (event) => {
      if (event.key === "Escape") closeGallery();
      if (event.key === "ArrowRight") changeGalleryIndex(1);
      if (event.key === "ArrowLeft") changeGalleryIndex(-1);
    };
    document.addEventListener("keydown", handleGalleryKey);
    return () => document.removeEventListener("keydown", handleGalleryKey);
  }, [changeGalleryIndex, closeGallery, galleryIndex, stackMessages]);

  const handleReply = () => {
    if (!message.id) return;
    setEditingMessage(null);
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
    target.style.outline = "3px solid var(--primary-border)";
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
    if (!data.chatId || !reactionMessageId || !currentUser?.uid) return;
    const chatRef = doc(db, "chats", data.chatId);
    const existingEmoji = messageReactions?.[currentUser.uid];
    try {
      await updateDoc(
        chatRef,
        new FieldPath("reactions", reactionMessageId, currentUser.uid),
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
    const matches = [...loveMatches.map((match) => ({ ...match, kind: "love" }))];
    const mentionPattern = /@[A-Za-z0-9_.-]+/g;
    let mention;
    while ((mention = mentionPattern.exec(message.text || "")) !== null) {
      matches.push({ index: mention.index, text: mention[0], kind: "mention" });
    }
    if (!matches.length) return message.text;
    matches.sort((left, right) => left.index - right.index);
    const content = [];
    let cursor = 0;
    matches.forEach((match, index) => {
      if (match.index < cursor) return;
      if (match.index > cursor) content.push(message.text.slice(cursor, match.index));
      content.push(
        <span
          key={`${match.index}-${index}`}
          className={match.kind === "mention"
            ? "text-[var(--primary-text)]"
            : shouldReduceMotion ? "love-word-static" : "love-word-pulse"}
        >
          {match.text}
        </span>
      );
      cursor = match.index + match.text.length;
    });
    if (cursor < message.text.length) content.push(message.text.slice(cursor));
    return content;
  };

  let isRead = false;
  if (isOwn && lastRead && displayedStackLast.status !== "sending") {
    const msgTime = displayedStackLast.date?.toMillis
      ? displayedStackLast.date.toMillis()
      : (displayedStackLast.date instanceof Date
        ? displayedStackLast.date.getTime()
        : (typeof displayedStackLast.date === "number" ? displayedStackLast.date : Date.now()));
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
      const link = document.createElement("a");
      link.href = message.img;
      link.setAttribute("download", `chat-image-${message.id || Date.now()}`);
      link.setAttribute("target", "_blank");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading image:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenOriginal = (e) => {
    e.stopPropagation();
    window.open(message.img, "_blank", "noopener,noreferrer");
  };

  return (
    <motion.div
      ref={ref}
      id={message.id ? `msg-${message.id}` : undefined}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`message-row flex items-end gap-2.5 group relative ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      style={rowGap ? { marginBottom: rowGap } : undefined}
    >
      {data.user?.isGroup && showGroupAvatar && !isOwn ? (
        <button type="button" onClick={() => openMemberPanel(senderMember)} className="mb-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label={`Open ${senderMember.displayName || "sender"} information`}>
          <Avatar
            src={message.senderPhoto || senderMember.photoURL || data.user.photoURL}
            alt={message.senderName || data.user.displayName}
            className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
          />
        </button>
      ) : <span className="w-7 flex-shrink-0" aria-hidden="true" />}

      <div className={`flex max-w-[78%] flex-col gap-1.5 ${isOwn ? "items-end" : "items-start"}`}>
        {data.user?.isGroup && showGroupSenderName && (
          <button type="button" onClick={() => openMemberPanel(senderMember)} className="self-start pl-1 text-xs font-semibold text-[var(--accent-name)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            {message.senderName || (isOwn ? currentUser.displayName : "Unknown")}
          </button>
        )}

        <div className="relative w-full">
          {!canHover && !isEditing && (
            <div
              className={`pointer-events-none absolute left-2 top-1/2 z-0 -translate-y-1/2 rounded-full p-2 text-[var(--primary-text)] ${isOwn ? "left-auto right-2" : ""}`}
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
          <div className="message-edit-row flex items-center gap-1.5 p-1.5">
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
              className="p-1 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
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
              className={`message-text-bubble relative max-w-full px-3.5 py-2.5 text-[15.5px] leading-relaxed ${
                isOwn ? "msg-bubble-sent" : "msg-bubble-received"
              } ${isLoveMessage ? "love-message-bubble" : ""}`}
            >
              {message.replyTo && <QuoteBlock replyTo={message.replyTo} isOwn={isOwn} onClick={handleQuoteClick} />}
              {renderLoveText()}
              <span className={`message-meta mt-1 flex items-center justify-end gap-1 text-[11px] ${isOwn ? "message-meta-own" : ""}`}>
                {message.editedAt && <span className="italic mr-0.5">(edited)</span>}
                {formatDate(message.date)}
                {isOwn && (
                  message.status === "sending" ? (
                    <Clock size={12} className="opacity-75 inline-block" aria-label="Sending" />
                  ) : message.status === "failed" ? (
                    <AlertCircle size={13} className="text-[var(--danger-text)] inline-block" aria-label="Failed to send" title="Failed to send" />
                  ) : isRead ? (
                    <CheckCheck size={14} className="text-[var(--seen)]" aria-label="Read" />
                  ) : (
                    <Check size={14} aria-label="Sent" />
                  )
                )}
              </span>
            </motion.div>
          )
        )}

        {stackMessages ? (
          <div className="relative">
            <div className="photo-stack" aria-label={`${stackMessages.length} photos`}>
              {visibleStackMessages.map((photo, index) => (
                <button
                  key={photo.id || index}
                  type="button"
                  className={`photo-stack-card photo-stack-card-${index}`}
                  onClick={() => setGalleryIndex(index)}
                  aria-label={`Open photo ${index + 1} of ${stackMessages.length}`}
                >
                  <img
                    src={optimizeUrl(photo.img, 800)}
                    alt={`${index + 1} of ${stackMessages.length}`}
                    loading="lazy"
                    className="h-full w-full rounded-[14px] object-cover"
                  />
                </button>
              ))}
              {stackMessages.length > 3 && (
                <span className="photo-stack-count">+{stackMessages.length - 3} photos</span>
              )}
            </div>
            <span className="photo-stack-meta">
              {formatDate(displayedStackLast.date)}
              {isOwn && (displayedStackLast.status === "sending"
                ? <Clock size={12} />
                : displayedStackLast.status === "failed"
                ? <AlertCircle size={12} />
                : isRead
                ? <CheckCheck size={12} className="text-[var(--seen)]" />
                : <Check size={12} />)}
            </span>
          </div>
        ) : message.img && (
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
              src={optimizeUrl(message.img, isExpanded ? 1600 : 800)}
              alt="attachment"
              width={typeof message.width === "number" ? message.width : undefined}
              height={typeof message.height === "number" ? message.height : undefined}
              className={`message-image rounded-2xl object-cover transition-all duration-300 ${
                isExpanded ? "max-h-[60vh] w-full object-contain" : "max-h-[200px] max-w-[260px]"
              }`}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.style.display = "none";
                const placeholder = document.createElement("div");
                placeholder.style.cssText =
                  "display:flex;align-items:center;justify-content:center;padding:12px 16px;border-radius:12px;font-size:11px;color:var(--text-muted);background:var(--surface-3);border:1px solid var(--border);min-width:120px;text-align:center;";
                placeholder.textContent = "Image unavailable";
                e.currentTarget.parentNode?.insertBefore(placeholder, e.currentTarget.nextSibling);
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 rounded-2xl flex items-center justify-center">
              <ZoomIn
                size={22}
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              />
              {message.hd === true && (
                <span className="absolute left-2 top-2 rounded bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-white shadow">HD</span>
              )}
            </div>

            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
              {message.editedAt && <span className="italic mr-0.5">(edited)</span>}
              {formatDate(message.date)}
              {isOwn && (
                message.status === "sending" ? (
                  <Clock size={11} className="opacity-75 inline-block" aria-label="Sending" />
                ) : message.status === "failed" ? (
                  <AlertCircle size={12} className="text-[var(--danger-text)] inline-block" aria-label="Failed to send" title="Failed to send" />
                ) : isRead ? (
                  <CheckCheck size={12} className="text-[var(--seen)] opacity-90" />
                ) : (
                  <Check size={12} className="opacity-80" />
                )
              )}
            </span>

            {isExpanded && (
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 }}
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="p-2.5 rounded-xl transition-all duration-200 disabled:opacity-50"
                  title="Download original"
                  aria-label="Download original image"
                >
                  <Download size={16} className={isDownloading ? "animate-pulse" : ""} />
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  onClick={handleOpenOriginal}
                  className="p-2.5 rounded-xl transition-all duration-200"
                  title="Open original"
                  aria-label="Open original image"
                >
                  <ExternalLink size={16} />
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
        {message.file?.url && (
          <div
            className="media-card mt-1 w-full max-w-sm overflow-hidden rounded-2xl border"
          >
            {message.file.mime?.startsWith("video/") ? (
              <video
                src={message.file.url}
                controls
                preload="metadata"
                className="max-h-[360px] w-full bg-black"
                aria-label={message.file.name || "Video attachment"}
              />
            ) : message.file.mime?.startsWith("audio/") ? (
              <div className="flex items-center gap-3 p-3">
                <Music4 size={18} className="flex-shrink-0 text-[var(--primary-light)]" />
                <audio src={message.file.url} controls preload="metadata" className="min-w-0 flex-1" aria-label={message.file.name || "Audio attachment"} />
              </div>
            ) : (
              <a
                href={message.file.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 p-3 transition-colors hover:bg-[var(--hover)]"
                aria-label={`Download ${message.file.name || "attachment"}`}
              >
                <FileText size={20} className="flex-shrink-0 text-[var(--primary-light)]" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-primary)]">
                  {message.file.name || "Attachment"}
                </span>
                <Download size={16} className="flex-shrink-0 text-[var(--text-muted)]" />
              </a>
            )}
            {(message.file.mime?.startsWith("video/") || message.file.mime?.startsWith("audio/")) && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)]">
                {message.file.mime.startsWith("video/") ? <Video size={14} /> : <Music4 size={14} />}
                <span className="min-w-0 truncate">{message.file.name || "Media attachment"}</span>
              </div>
            )}
          </div>
        )}
        </motion.div>
        {loveBurstKey > 0 && (
          <div key={loveBurstKey} className="pointer-events-none absolute inset-0 z-30">
            <LoveEffect />
          </div>
        )}
        {Object.entries(reactionCounts).length > 0 && (
          <div className={`relative z-10 -mt-3 flex flex-wrap gap-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactionCounts).map(([emoji, reaction]) => (
              <motion.button
                key={emoji}
                type="button"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                onClick={() => handleReaction(emoji)}
                className={`reaction-chip ${reaction.includesMe ? "is-mine" : ""}`}
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
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary-light)] hover:bg-[var(--hover)] transition-colors focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            title="React"
            aria-label="Add a reaction"
          >
            <Smile size={14} />
          </button>
          <button
            type="button"
            onClick={handleReply}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary-light)] hover:bg-[var(--hover)] transition-colors focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            title="Reply"
            aria-label="Reply to message"
          >
            <Reply size={14} />
          </button>
          {isOwn && (
            <>
          {message.text && (
            <button
              onClick={() => {
                setEditingMessage(message);
                setReplyingTo(null);
                setIsEditing(false);
              }}
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
            className="glass reaction-picker fixed z-[70] flex items-center justify-between gap-1 rounded-full px-2 py-1.5 shadow-xl"
            style={{ left: reactionPicker.left, top: reactionPicker.top, width: 236 }}
            role="group"
            aria-label="Quick reactions"
          >
            {["❤️", "😂", "😮", "😢", "👍", "🙏"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(emoji)}
                className="rounded-full p-1.5 text-lg leading-none transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {galleryIndex !== null && stackMessages && (
          <motion.div
            className="photo-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeGallery}
            role="dialog"
            aria-modal="true"
            aria-label="Photo gallery"
          >
            <button type="button" className="photo-lightbox-close" onClick={closeGallery} aria-label="Close gallery">
              <X size={20} />
            </button>
            <button
              type="button"
              className="photo-lightbox-arrow photo-lightbox-prev"
              onClick={(event) => { event.stopPropagation(); changeGalleryIndex(-1); }}
              aria-label="Previous photo"
            >
              ‹
            </button>
            <img
              src={optimizeUrl(stackMessages[galleryIndex].img, 1600)}
              alt={`${galleryIndex + 1} of ${stackMessages.length}`}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => { galleryPointerRef.current = event.clientX; }}
              onPointerUp={(event) => {
                const start = galleryPointerRef.current;
                if (start === null) return;
                const delta = event.clientX - start;
                if (Math.abs(delta) > 45) changeGalleryIndex(delta < 0 ? 1 : -1);
                galleryPointerRef.current = null;
              }}
              className="photo-lightbox-image"
            />
            <button
              type="button"
              className="photo-lightbox-arrow photo-lightbox-next"
              onClick={(event) => { event.stopPropagation(); changeGalleryIndex(1); }}
              aria-label="Next photo"
            >
              ›
            </button>
            <span className="photo-lightbox-count">{galleryIndex + 1} / {stackMessages.length}</span>
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
    previousMessage.width === nextMessage.width &&
    previousMessage.height === nextMessage.height &&
    previousMessage.hd === nextMessage.hd &&
    previousMessage.type === nextMessage.type &&
    previousMessage.senderId === nextMessage.senderId &&
    previousMessage.senderName === nextMessage.senderName &&
    previousMessage.senderPhoto === nextMessage.senderPhoto &&
    previousMessage.editedAt === nextMessage.editedAt &&
    previousMessage.status === nextMessage.status &&
    sameDate(previousMessage.date, nextMessage.date) &&
    sameReply &&
    previous.isLive === next.isLive &&
    previous.showGroupSenderName === next.showGroupSenderName &&
    previous.showGroupAvatar === next.showGroupAvatar &&
    previous.rowGap === next.rowGap &&
    previous.photoStack === next.photoStack &&
    previous.photoStackLastMessage === next.photoStackLastMessage &&
    sameObject(previous.lastRead, next.lastRead) &&
    sameObject(previous.reactions, next.reactions);
};

export default memo(Message, areMessagePropsEqual);
