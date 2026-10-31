import React, { useContext, useRef, useState, useEffect, memo, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import { ChatContext, ContactPanelActionsContext } from "../context/ChatContexts";
import { Download, ExternalLink, ZoomIn, Check, CheckCheck, Edit2, Trash2, X, Check as SaveIcon, Clock, AlertCircle, Reply, Smile, MoreHorizontal, FileText, Video, Forward } from "lucide-react";
import { deleteField, doc, FieldPath, runTransaction, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import Avatar from "./Avatar";
import LoveEffect from "./LoveEffect";
import { getLoveMatches, hasLoveMessage } from "../utils/loveDetect";
import { cloudinaryUrl } from "../utils/cloudinary";
import { formatTime } from "../utils/formatters";
import { formatVoiceDuration } from "../utils/voiceRecorder";
import { safeHttpUrl } from "../utils/safeUrl";
import VoiceMessage from "./VoiceMessage";
import LazyImage from "./ui/LazyImage";
import LazyVideo from "./ui/LazyVideo";
import { getOwnMediaUrl, rememberOwnMedia } from "../utils/ownMediaCache";

const playedLoveMessageIds = new Set();
const galleryNeighbor = (url) => React.createElement("img", {
  src: cloudinaryUrl(safeHttpUrl(url) || "", { w: 1600, q: "auto", fmt: "auto" }),
  alt: "",
  "aria-hidden": true,
  className: "hidden",
});

const QuoteBlock = ({ replyTo, isOwn, onClick }) => {
  const imageUrl = safeHttpUrl(replyTo.img);
  return <button
    type="button"
    onClick={onClick}
    className={`message-quote mb-2 block w-full rounded-md border-l-[3px] px-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${isOwn ? "is-own" : ""}`}
    aria-label={`Jump to message from ${replyTo.senderName || "User"}`}
  >
    <span className="block truncate text-[11px] font-semibold">{replyTo.senderName || "User"}</span>
    <span className="flex items-center gap-2">
      {imageUrl && <LazyImage src={imageUrl} alt="" width={96} height={54} sizes="96px" className="h-[54px] w-24 shrink-0 rounded" />}
      <span
        className="block text-xs leading-snug"
        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {replyTo.type === "image"
          ? "📷 Photo"
          : replyTo.type === "gif"
            ? "GIF"
            : replyTo.type === "audio"
              ? `🎤 Voice message${Number.isFinite(replyTo.duration) ? ` ${formatVoiceDuration(replyTo.duration).replace(/^0(?=\d:)/, "")}` : ""}`
              : replyTo.text || "Message"}
      </span>
    </span>
  </button>;
};

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
  nextVoiceMessage = null,
  priority = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text || "");
  const [savingEdit, setSavingEdit] = useState(false);
  const { currentUser } = useContext(AuthContext);
  const { data, setReplyingTo, setEditingMessage, setForwardingMessage } = useContext(ChatContext);
  const { openContactPanelUser: openMemberPanel } = useContext(ContactPanelActionsContext);
  const ref = useRef();
  const reactionPickerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const pointerStartRef = useRef(null);
  const galleryPointerRef = useRef(null);
  const [canHover, setCanHover] = useState(false);
  const [reactionPicker, setReactionPicker] = useState(null);
  const [messageMenu, setMessageMenu] = useState(null);
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
  const isVoiceMessage = message.type === "audio" || Boolean(message.audio?.url) || message.file?.mime?.startsWith("audio/");
  const safeImageUrl = safeHttpUrl(message.img);
  const safeFileUrl = safeHttpUrl(message.file?.url);
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
    const isAudio = message.type === "audio" || Boolean(message.audio) || message.file?.mime?.startsWith("audio/");
    const type = isAudio ? "audio" : message.type === "image" ? "image" : message.type === "gif" || message.img ? "gif" : "text";
    const duration = message.audio?.duration ?? message.file?.duration ?? message.duration;
    setReplyingTo({
      id: message.id,
      senderId: message.senderId || "",
      senderName: message.senderName || (isOwn ? currentUser.displayName : "User") || "User",
      text: message.text || "",
      type,
      ...(isAudio && Number.isFinite(duration) ? { duration } : {}),
      ...(message.img ? { img: message.img } : {}),
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

  const openMessageMenu = (anchor) => {
    const rect = anchor?.getBoundingClientRect() || ref.current?.getBoundingClientRect();
    if (!rect) return;
    setMessageMenu({
      left: Math.max(8, Math.min(rect.right - 208, window.innerWidth - 216)),
      top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 170)),
    });
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

  const syncChatPreview = async (transaction, latestMessage) => {
    const memberUids = data.user?.isGroup
      ? [...new Set((data.user.members || []).map((member) => member.uid).filter(Boolean))]
      : [...new Set([currentUser.uid, data.user?.uid].filter(Boolean))];
    const userChatRefs = memberUids.map((uid) => doc(db, "userChats", uid));
    const snapshots = await Promise.all(userChatRefs.map((userChatRef) => transaction.get(userChatRef)));
    const preview = latestMessage
      ? {
          text: latestMessage.text || "",
          senderId: latestMessage.senderId || "",
          date: latestMessage.date || Date.now(),
          ...(latestMessage.type ? { type: latestMessage.type } : {}),
        }
      : deleteField();
    const date = latestMessage?.date || (latestMessage ? Date.now() : deleteField());

    snapshots.forEach((snapshot, index) => {
      if (!snapshot.exists()) return;
      transaction.update(
        userChatRefs[index],
        new FieldPath(data.chatId, "lastMessage"),
        preview,
        new FieldPath(data.chatId, "date"),
        date
      );
    });
  };

  const startLongPress = (event) => {
    if (canHover || event.pointerType === "mouse") return;
    const anchor = event.currentTarget;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      openMessageMenu(anchor);
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
      await runTransaction(db, async (transaction) => {
        const chatSnap = await transaction.get(chatRef);
        if (!chatSnap.exists()) return;
        const msgs = Array.isArray(chatSnap.data().messages) ? chatSnap.data().messages : [];
        const messageIndex = msgs.findIndex((item) => item.id === message.id);
        if (messageIndex === -1) return;
        const updated = msgs.map((m) =>
          m.id === message.id ? { ...m, text: editText.trim(), editedAt: Date.now() } : m
        );
        if (messageIndex === msgs.length - 1) {
          await syncChatPreview(transaction, updated[messageIndex]);
        }
        transaction.update(chatRef, { messages: updated });
      });
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
      await runTransaction(db, async (transaction) => {
        const chatSnap = await transaction.get(chatRef);
        if (!chatSnap.exists()) return;
        const msgs = Array.isArray(chatSnap.data().messages) ? chatSnap.data().messages : [];
        const messageIndex = msgs.findIndex((item) => item.id === message.id);
        if (messageIndex === -1) return;
        const updated = msgs.filter((m) => m.id !== message.id);
        if (messageIndex === msgs.length - 1) {
          await syncChatPreview(transaction, updated[updated.length - 1]);
        }
        transaction.update(chatRef, { messages: updated });
      });
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      const link = document.createElement("a");
      const imageUrl = safeHttpUrl(message.img);
      if (!imageUrl) throw new Error("This image has an unsafe or invalid URL.");
      link.href = imageUrl;
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
    const imageUrl = safeHttpUrl(message.img);
    if (!imageUrl) {
      console.warn("Could not open image with an unsafe or invalid URL.");
      return;
    }
    window.open(imageUrl, "_blank", "noopener,noreferrer");
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
          onContextMenu={(event) => {
            event.preventDefault();
            openMessageMenu(event.currentTarget);
          }}
          onClick={() => {
            if (isLoveMessage && !shouldReduceMotion) setLoveBurstKey((key) => key + 1);
          }}
        >
        {isEditing ? (
          <div className="message-edit-row flex items-center gap-1.5 p-1.5">
            <input
              type="text"
              aria-label="Edit message"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              className="bg-transparent text-sm text-[var(--text-primary)] outline-none px-2 py-1 flex-1 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              autoFocus
            />
            <button
              onClick={handleSaveEdit}
              disabled={savingEdit}
              className="p-1 rounded-lg bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-hover)]"
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
          message.text && !(isVoiceMessage && message.text.startsWith("🎤 Voice message")) && (
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
                {formatTime(message.date, { hour: "2-digit", minute: "2-digit" })}
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
                  <LazyImage
                    src={(photo.senderId === currentUser.uid && getOwnMediaUrl(photo.id)) || safeHttpUrl(photo.img) || ""}
                    alt={`${index + 1} of ${stackMessages.length}`}
                    width={photo.width}
                    height={photo.height}
                    sizes="260px"
                    priority={priority && index < 2}
                    className="h-full w-full rounded-[14px]"
                    manualLoadAction="container"
                    onLocalBlob={photo.senderId === currentUser.uid
                      ? (url) => rememberOwnMedia(photo.id, data.chatId, url)
                      : undefined}
                  />
                </button>
              ))}
              {stackMessages.length > 3 && (
                <span className="photo-stack-count">+{stackMessages.length - 3} photos</span>
              )}
            </div>
            <span className="photo-stack-meta">
              {formatTime(displayedStackLast.date, { hour: "2-digit", minute: "2-digit" })}
              {isOwn && (displayedStackLast.status === "sending"
                ? <Clock size={12} />
                : displayedStackLast.status === "failed"
                ? <AlertCircle size={12} />
                : isRead
                ? <CheckCheck size={12} className="text-[var(--seen)]" />
                : <Check size={12} />)}
            </span>
          </div>
        ) : safeImageUrl && (
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
            {message.type === "gif" && (message.gifMp4 || message.gifWebm)
              ? React.createElement(LazyVideo, {
                src: message.gifMp4 || message.gifWebm,
                alternateSrc: message.gifMp4 && message.gifWebm ? message.gifWebm : undefined,
                poster: safeHttpUrl(message.gifPreview) || safeImageUrl,
                width: message.width,
                height: message.height,
                className: `message-image rounded-2xl ${isExpanded ? "max-h-[60vh] w-full" : "max-h-[200px] max-w-[260px]"}`,
                ariaLabel: "Animated GIF",
                autoPlayInView: true,
                kind: "gif",
              })
              : <LazyImage
                src={(isOwn && getOwnMediaUrl(message.id)) || safeImageUrl}
                alt="attachment"
                width={message.width}
                height={message.height}
                sizes={isExpanded ? "100vw" : "(max-width: 640px) 260px, 320px"}
                widths={isExpanded ? [320, 640, 960, 1280, 1600] : [320, 640, 960]}
                priority={priority}
                objectFit={isExpanded ? "contain" : "cover"}
                className={`message-image rounded-2xl ${
                  isExpanded ? "max-h-[60vh] w-full object-contain" : "max-h-[200px] max-w-[260px]"
                }`}
                onLocalBlob={isOwn ? (url) => rememberOwnMedia(message.id, data.chatId, url) : undefined}
              />}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 rounded-2xl flex items-center justify-center">
              <ZoomIn
                size={22}
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              />
              {message.hd === true && (
                <span className="absolute left-2 top-2 rounded bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--on-primary)] shadow">HD</span>
              )}
            </div>

            <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
              {message.editedAt && <span className="italic mr-0.5">(edited)</span>}
              {formatTime(message.date, { hour: "2-digit", minute: "2-digit" })}
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
        {(message.audio?.url || (message.file?.url && (message.type === "audio" || message.file.mime?.startsWith("audio/")))) &&
          !message.deleted &&
          !message.deletedAt &&
          message.type !== "deleted" && (
          <div className={`media-card mt-1 w-full max-w-sm rounded-2xl border px-3 py-2.5 ${isOwn ? "msg-bubble-sent" : "msg-bubble-received"}`}>
            {message.replyTo && <QuoteBlock replyTo={message.replyTo} isOwn={isOwn} onClick={handleQuoteClick} />}
            <VoiceMessage
              message={message}
              isOwn={isOwn}
              chatId={data.chatId}
              nextMessage={nextVoiceMessage}
              uploading={message.status === "uploading"}
              uploadProgress={message.uploadProgress || 0}
              uploadFailed={message.status === "failed"}
              uploadError={message.error}
              onCancelUpload={message.cancel}
              onRetryUpload={message.retry}
              onDeleteUpload={message.delete || message.cancel}
            />
            <span className={`mt-1 flex items-center justify-end gap-1 text-[11px] ${isOwn ? "message-meta-own" : "text-[var(--text-secondary)]"}`}>
              {formatTime(message.date, { hour: "2-digit", minute: "2-digit" })}
              {isOwn && message.status === "uploading" && <Clock size={12} aria-label="Uploading" />}
              {isOwn && message.status === "failed" && <AlertCircle size={12} className="text-[var(--danger-text)]" aria-label="Failed to send" />}
              {isOwn && !["uploading", "failed"].includes(message.status) && <Check size={12} aria-label="Sent" />}
            </span>
          </div>
        )}
        {safeFileUrl && !message.file.mime?.startsWith("audio/") && (
          <div
            className="media-card mt-1 w-full max-w-sm overflow-hidden rounded-2xl border"
          >
            {message.file.mime?.startsWith("video/") ? (
              React.createElement(LazyVideo, {
                src: safeFileUrl,
                width: message.file.width,
                height: message.file.height,
                ariaLabel: message.file.name || "Video attachment",
                className: "max-h-[360px] w-full bg-black",
              })
            ) : (
              <a
                href={safeFileUrl || undefined}
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
            {message.file.mime?.startsWith("video/") && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--text-secondary)]">
                <Video size={14} />
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

      {canHover && !isEditing && message.status !== "sending" && (
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
          <button
            type="button"
            onClick={(event) => openMessageMenu(event.currentTarget)}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary-light)] hover:bg-[var(--hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            title="More message actions"
            aria-label="More message actions"
            aria-haspopup="menu"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      )}

      <AnimatePresence>
        {messageMenu && <>
          <button type="button" className="fixed inset-0 z-[69] cursor-default" aria-label="Close message actions" onClick={() => setMessageMenu(null)} />
          <motion.div
            role="menu"
            aria-label="Message actions"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="glass fixed z-[70] w-52 rounded-xl border border-[var(--border)] p-1 shadow-xl"
            style={messageMenu}
          >
            <button type="button" role="menuitem" className="menu-row" onClick={() => { setMessageMenu(null); openReactionPicker(ref.current); }}>
              <Smile size={15} />React
            </button>
            {isVoiceMessage && !message.deleted && !message.deletedAt && message.type !== "deleted" && (
              <button
                type="button"
                role="menuitem"
                className="menu-row"
                onClick={() => {
                  setMessageMenu(null);
                  setForwardingMessage(message);
                }}
              >
                <Forward size={15} />Forward voice message
              </button>
            )}
            {isOwn && message.text && <button type="button" role="menuitem" className="menu-row" onClick={() => {
              setMessageMenu(null);
              setEditingMessage(message);
              setReplyingTo(null);
              setIsEditing(false);
            }}><Edit2 size={15} />Edit message</button>}
            {isOwn && <button type="button" role="menuitem" className="menu-row text-[var(--danger-text)]" onClick={() => { setMessageMenu(null); handleDelete(); }}>
              <Trash2 size={15} />Delete message
            </button>}
          </motion.div>
        </>}
      </AnimatePresence>

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
            <LazyImage
              src={cloudinaryUrl(safeHttpUrl(stackMessages[galleryIndex].img) || "", { w: 1600, q: "auto", fmt: "auto" })}
              alt={`${galleryIndex + 1} of ${stackMessages.length}`}
              width={stackMessages[galleryIndex].width}
              height={stackMessages[galleryIndex].height}
              priority
              objectFit="contain"
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
            {galleryNeighbor(stackMessages[(galleryIndex + 1) % stackMessages.length].img)}
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
    previousMessage.gifMp4 === nextMessage.gifMp4 &&
    previousMessage.gifWebm === nextMessage.gifWebm &&
    previousMessage.gifPreview === nextMessage.gifPreview &&
    previous.priority === next.priority &&
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
