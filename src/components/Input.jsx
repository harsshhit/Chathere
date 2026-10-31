import React, { lazy, Suspense, useContext, useState, useRef, useEffect, useReducer, useCallback } from "react";
import {
  Send,
  Smile,
  X,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  FileText,
  Video,
  Music4,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Mic,
  Pause,
  Play,
  Square,
  Trash2,
  Forward,
} from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { ChatContext, UserChatsContext } from "../context/ChatContexts";
import {
  doc,
  FieldPath,
  getDoc,
  Timestamp,
  updateDoc,
  runTransaction,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { v4 as uuid } from "uuid";
import LazyImage from "./ui/LazyImage";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";
import { pendingMessagesStore } from "../utils/pendingMessages";
import { uploadFile } from "../utils/cloudinary";
import { getVoiceFileExtension, formatVoiceDuration, isVoiceSupported, VoiceRecorder } from "../utils/voiceRecorder";
import VoiceMessage, { activateVoiceMessage, deactivateVoiceMessage, pauseActiveVoiceMessage } from "./VoiceMessage";
import {
  MAX_IMAGE_MB,
  MAX_VIDEO_MB,
  MAX_FILE_MB,
  MAX_AUDIO_MB,
  MAX_FILES_PER_MESSAGE,
  BLOCKED_EXTENSIONS,
} from "../config/uploadLimits";
import { compressImage } from "../utils/compressImage";
import { formatFileSize as formatBytes } from "../utils/formatters";
import { writeChatMessages } from "../utils/chatMessageWrites";

const EmojiPicker = lazy(() => import("emoji-picker-react"));
const GifPicker = lazy(() => import("./GifPicker"));

const getAttachmentKind = (file) => {
  if (!file || !file.type) return "file";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "file";
};

const getAttachmentLimit = (kind) => {
  switch (kind) {
    case "image": return MAX_IMAGE_MB * 1024 * 1024;
    case "video": return MAX_VIDEO_MB * 1024 * 1024;
    case "audio": return MAX_AUDIO_MB * 1024 * 1024;
    default: return MAX_FILE_MB * 1024 * 1024;
  }
};

const isHdCapableImage = (file) => {
  const extension = file?.name?.split(".").pop()?.toLowerCase();
  return file?.type?.startsWith("image/") && file.type !== "image/gif" && file.type !== "image/svg+xml" && !["gif", "svg"].includes(extension);
};

const getSizeError = (item, hd = item.hd) => {
  const source = hd ? item.file : item.compressed?.file || item.file;
  const limit = getAttachmentLimit("image");
  if (!item.file?.type?.startsWith("image/") || source.size <= limit) return "";
  return hd
    ? `HD too large (${formatBytes(source.size)}, max ${formatBytes(limit)}), switch to standard`
    : `Too large (${formatBytes(source.size)}, max ${formatBytes(limit)})`;
};

const getImageSizeLabel = (item) => {
  if (!isHdCapableImage(item.file) || item.compressionSkipped || !item.compressed) return formatBytes(item.file.size);
  if (item.hd) return `${formatBytes(item.file.size)} original`;
  const savings = Math.max(0, Math.round((1 - item.compressed.compressedSize / item.file.size) * 100));
  return savings > 0
    ? `${formatBytes(item.compressed.compressedSize)} (was ${formatBytes(item.file.size)}, -${savings}%)`
    : formatBytes(item.file.size);
};

const compactVoiceDuration = (duration) => formatVoiceDuration(duration).replace(/^0(?=\d:)/, "");
const emptyVoiceWaveform = () => Array.from({ length: 40 }, () => 6);

const getBlockedStatus = (file) => {
  const name = file?.name || "";
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  if (extension && BLOCKED_EXTENSIONS.includes(extension)) {
    return { status: "blocked", message: `Blocked file type: .${extension}` };
  }
  const kind = getAttachmentKind(file);
  if (kind === "image") return { status: "queued", message: "" };
  const maxBytes = getAttachmentLimit(kind);
  if (file.size > maxBytes) {
    const maxMB = (maxBytes / (1024 * 1024)).toFixed(kind === "file" ? 0 : 0);
    return {
      status: "error",
      message: `Too large (${(file.size / (1024 * 1024)).toFixed(1)} MB, max ${maxMB} MB)`,
    };
  }
  return { status: "queued", message: "" };
};

const attachmentReducer = (state, action) => {
  switch (action.type) {
    case "replace":
      return action.items;
    case "clear":
      return [];
    case "remove":
      return state.filter((item) => item.id !== action.id);
    case "update":
      return state.map((item) => (item.id === action.id ? { ...item, ...action.changes } : item));
    case "add": {
      const nextItems = [...state, ...action.items];
      return nextItems.slice(-MAX_FILES_PER_MESSAGE);
    }
    default:
      return state;
  }
};

const Input = () => {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [attachmentQueue, dispatchAttachments] = useReducer(attachmentReducer, []);
  const [isDragOver, setIsDragOver] = useState(false);
  const [voiceState, setVoiceState] = useState("idle");
  const [voiceElapsed, setVoiceElapsed] = useState(0);
  const [voiceWaveform, setVoiceWaveform] = useState(emptyVoiceWaveform);
  const [voicePreview, setVoicePreview] = useState(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [voiceNotice, setVoiceNotice] = useState("");
  const [voiceAnnouncement, setVoiceAnnouncement] = useState("");
  const [forwardingBusy, setForwardingBusy] = useState(false);
  const [forwardingChatId, setForwardingChatId] = useState("");
  const [forwardError, setForwardError] = useState("");

  const { currentUser } = useContext(AuthContext);
  const {
    data,
    replyingTo,
    setReplyingTo,
    editingMessage,
    setEditingMessage,
    forwardingMessage,
    setForwardingMessage,
  } = useContext(ChatContext);
  const userChats = useContext(UserChatsContext);
  const { theme } = useTheme();
  const shouldReduceMotion = useReducedMotion();
  const pickerRef = useRef(null);
  const quickActionsRef = useRef(null);
  const inputRef = useRef(null);
  const queueInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingWriteAtRef = useRef(0);
  const typingActiveRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const imageInputRef = useRef(null);
  const draftsRef = useRef({});
  const voiceRecorderRef = useRef(null);
  const voiceRecorderStartingRef = useRef(false);
  const voiceStateRef = useRef("idle");
  const voicePreviewRef = useRef(null);
  const voiceRecorderNoticeRef = useRef("");
  const previewAudioRef = useRef(null);
  const previewSliderRef = useRef(null);
  const previewNeedsDurationFixRef = useRef(false);
  const forwardJobsRef = useRef(new Map());
  const voiceOwnerRef = useRef({ chatId: data.chatId, uid: currentUser?.uid });
  const setVoiceStage = useCallback((nextState) => {
    voiceStateRef.current = nextState;
    setVoiceState(nextState);
  }, []);
  const attachmentQueueRef = useRef(attachmentQueue);
  const compressionQueueRef = useRef({ pending: [], active: 0 });
  const compressionScheduleRef = useRef(null);
  attachmentQueueRef.current = attachmentQueue;

  useEffect(() => () => {
    attachmentQueueRef.current.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    voiceRecorderRef.current?.cancel();
    voiceRecorderRef.current = null;
    previewAudioRef.current?.pause();
    if (voicePreviewRef.current?.url) URL.revokeObjectURL(voicePreviewRef.current.url);
    voicePreviewRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingActiveRef.current && data.chatId && currentUser?.uid) {
        typingActiveRef.current = false;
        lastTypingWriteAtRef.current = 0;
        updateDoc(
          doc(db, "chats", data.chatId),
          new FieldPath("typing", currentUser.uid),
          false
        ).catch((error) => console.error("Could not clear typing state:", error));
      }
    };
  }, [data.chatId, currentUser?.uid]);

  const revokeVoicePreview = useCallback((preview = voicePreviewRef.current) => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    if (!preview || voicePreviewRef.current === preview) {
      voicePreviewRef.current = null;
      setVoicePreview(null);
      setPreviewPlaying(false);
      setPreviewTime(0);
      previewNeedsDurationFixRef.current = false;
    }
  }, []);

  const cancelVoiceRecording = useCallback((discardPreview = true) => {
    voiceRecorderStartingRef.current = false;
    voiceRecorderRef.current?.cancel();
    voiceRecorderRef.current = null;
    previewAudioRef.current?.pause();
    setVoiceStage("idle");
    setVoiceElapsed(0);
    setVoiceWaveform(emptyVoiceWaveform());
    setVoiceNotice("");
    voiceRecorderNoticeRef.current = "";
    if (discardPreview) revokeVoicePreview();
  }, [revokeVoicePreview, setVoiceStage]);

  useEffect(() => {
    const previous = voiceOwnerRef.current;
    if (
      (previous.chatId && previous.chatId !== data.chatId) ||
      (previous.uid && previous.uid !== currentUser?.uid)
    ) {
      cancelVoiceRecording();
    }
    voiceOwnerRef.current = { chatId: data.chatId, uid: currentUser?.uid };
  }, [data.chatId, currentUser?.uid, cancelVoiceRecording]);

  useEffect(() => {
    if (!["requesting", "recording", "preview"].includes(voiceState)) return undefined;
    const handleVoiceEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelVoiceRecording();
      }
    };
    document.addEventListener("keydown", handleVoiceEscape);
    return () => document.removeEventListener("keydown", handleVoiceEscape);
  }, [voiceState, cancelVoiceRecording]);

  useEffect(() => {
    forwardJobsRef.current.clear();
    setForwardingBusy(false);
    setForwardingChatId("");
    setForwardError("");
  }, [forwardingMessage?.id]);

  useEffect(() => {
    if (!forwardingMessage) return undefined;
    const handleForwardEscape = (event) => {
      if (event.key === "Escape" && !forwardingBusy) {
        setForwardingMessage(null);
      }
    };
    window.addEventListener("keydown", handleForwardEscape);
    return () => window.removeEventListener("keydown", handleForwardEscape);
  }, [forwardingMessage, forwardingBusy, setForwardingMessage]);

  useEffect(() => {
    if (!data.chatId) return;
    const savedDraft = draftsRef.current[data.chatId] ?? "";
    setText(savedDraft);
  }, [data.chatId]);

  useEffect(() => {
    if (replyingTo || editingMessage) {
      inputRef.current?.focus();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [replyingTo, editingMessage]);

  useEffect(() => {
    if (!data.chatId) return;
    if (editingMessage) {
      const nextValue = editingMessage.text || "";
      draftsRef.current[data.chatId] = nextValue;
      setText(nextValue);
    }
  }, [data.chatId, editingMessage]);

  useEffect(() => {
    if (!inputRef.current) return;
    const textarea = inputRef.current;
    textarea.style.height = "auto";
    const maxHeight = 160;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [text]);

  const getReplyPayload = () => {
    if (!replyingTo) return {};
    return {
      replyTo: {
        id: replyingTo.id || "",
        senderId: replyingTo.senderId || "",
        senderName: replyingTo.senderName || "User",
        text: String(replyingTo.text || "").slice(0, 100),
        type: ["text", "gif", "image", "audio"].includes(replyingTo.type) ? replyingTo.type : "text",
        ...(replyingTo.img ? { img: replyingTo.img } : {}),
        ...(replyingTo.type === "audio" && Number.isFinite(replyingTo.duration) ? { duration: replyingTo.duration } : {}),
      },
    };
  };

  const stopTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = null;
    lastTypingWriteAtRef.current = 0;
    if (data.chatId && currentUser?.uid && typingActiveRef.current) {
      typingActiveRef.current = false;
      updateDoc(
        doc(db, "chats", data.chatId),
        new FieldPath("typing", currentUser.uid),
        false
      ).catch((error) =>
        console.error("Could not clear typing state:", error)
      );
    }
  };

  const markTyping = () => {
    if (!data.chatId || !currentUser?.uid) return;
    const now = Date.now();
    if (!typingActiveRef.current || now - lastTypingWriteAtRef.current >= 2000) {
      lastTypingWriteAtRef.current = now;
      typingActiveRef.current = true;
      updateDoc(
        doc(db, "chats", data.chatId),
        new FieldPath("typing", currentUser.uid),
        true
      ).catch((error) => console.error("Could not update typing state:", error));
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 2000);
  };

  const persistDraft = (nextValue) => {
    if (data.chatId) {
      draftsRef.current[data.chatId] = nextValue;
    }
    setText(nextValue);
  };

  const clearDraft = () => {
    if (data.chatId) {
      delete draftsRef.current[data.chatId];
    }
    setText("");
  };

  const drainCompressionQueue = useCallback(() => {
    const queue = compressionQueueRef.current;
    while (queue.active < 2 && queue.pending.length) {
      const item = queue.pending.shift();
      queue.active += 1;
      compressImage(item.file).then((result) => {
        const currentItem = attachmentQueueRef.current.find((entry) => entry.id === item.id) || item;
        const compressed = result.skipped ? null : {
          file: result.file,
          width: result.width,
          height: result.height,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
        };
        const nextItem = { ...currentItem, compressed };
        const error = getSizeError(nextItem, currentItem.hd);
        dispatchAttachments({
          type: "update",
          id: item.id,
          changes: {
            compressed,
            compressionSkipped: result.skipped,
            status: error ? "error" : "queued",
            error,
            sizeError: Boolean(error),
          },
        });
      }).finally(() => {
        queue.active -= 1;
        drainCompressionQueue();
      });
    }
  }, []);

  const scheduleCompressionDrain = useCallback(() => {
    if (compressionScheduleRef.current) return;
    const run = () => {
      compressionScheduleRef.current = null;
      drainCompressionQueue();
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 1500 });
      compressionScheduleRef.current = { kind: "idle", id };
    } else {
      const id = window.setTimeout(run, 1000);
      compressionScheduleRef.current = { kind: "timeout", id };
    }
  }, [drainCompressionQueue]);

  const scheduleImageCompression = useCallback((item) => {
    compressionQueueRef.current.pending.push(item);
    scheduleCompressionDrain();
  }, [scheduleCompressionDrain]);

  useEffect(() => () => {
    const scheduled = compressionScheduleRef.current;
    if (!scheduled) return;
    if (scheduled.kind === "idle" && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(scheduled.id);
    } else if (scheduled.kind === "timeout") {
      window.clearTimeout(scheduled.id);
    }
  }, []);

  const handleFilesAdded = useCallback((incomingFiles) => {
    const files = Array.from(incomingFiles || []).filter(Boolean);
    if (!files.length) return;

    const currentCount = attachmentQueue.length;
    const remainingSlots = Math.max(0, MAX_FILES_PER_MESSAGE - currentCount);
    const usableFiles = files.slice(0, remainingSlots);
    if (!usableFiles.length) return;

    const nextItems = usableFiles.map((file) => {
      const validation = getBlockedStatus(file);
      const isImage = file.type?.startsWith("image/");
      const previewUrl = isImage ? URL.createObjectURL(file) : "";
      return {
        id: uuid(),
        file,
        previewUrl,
        status: isImage && validation.status !== "blocked" ? "compressing" : validation.status,
        hd: false,
        compressed: null,
        compressionSkipped: false,
        sizeError: false,
        progress: 0,
        error: validation.status === "error" ? validation.message : validation.status === "blocked" ? validation.message : "",
        retryable: false,
        result: null,
      };
    });

    dispatchAttachments({ type: "add", items: nextItems });
    nextItems.filter((item) => item.status === "compressing").forEach(scheduleImageCompression);
  }, [attachmentQueue.length, scheduleImageCompression]);

  const removeAttachment = (id) => {
    const item = attachmentQueue.find((entry) => entry.id === id);
    if (item?.controller) item.controller.abort();
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    dispatchAttachments({ type: "remove", id });
  };

  const setAttachmentHd = (id, hd) => {
    const item = attachmentQueueRef.current.find((entry) => entry.id === id);
    if (!item || !isHdCapableImage(item.file) || item.status === "compressing") {
      if (item && isHdCapableImage(item.file) && item.status === "compressing") {
        dispatchAttachments({ type: "update", id, changes: { hd } });
      }
      return;
    }
    const nextItem = { ...item, hd };
    const error = getSizeError(nextItem, hd);
    dispatchAttachments({
      type: "update",
      id,
      changes: {
        hd,
        status: item.sizeError ? (error ? "error" : "queued") : item.status,
        error: item.sizeError ? error : item.error,
        sizeError: Boolean(error),
      },
    });
  };

  const setAllImagesHd = (hd) => {
    attachmentQueueRef.current
      .filter((item) => isHdCapableImage(item.file))
      .forEach((item) => setAttachmentHd(item.id, hd));
  };

  const startAttachmentUpload = async (item) => {
    if (!item || item.status === "blocked" || item.status === "compressing" || item.sizeError || (item.status === "error" && !item.retryable)) return;
    const controller = new AbortController();
    dispatchAttachments({
      type: "update",
      id: item.id,
      changes: { status: "uploading", progress: 0, error: "", controller },
    });

    try {
      const uploadSource = item.hd ? item.file : item.compressed?.file || item.file;
      const result = await uploadFile(uploadSource, {
        folder: "chathere/chat",
        signal: controller.signal,
        onProgress: (progress) => {
          dispatchAttachments({ type: "update", id: item.id, changes: { progress } });
        },
      });
      dispatchAttachments({
        type: "update",
        id: item.id,
        changes: { status: "done", progress: 100, error: "", result },
      });
    } catch (error) {
      dispatchAttachments({
        type: "update",
        id: item.id,
        changes: {
          status: "error",
          progress: 0,
          error: error?.message || "Upload failed.",
          retryable: true,
          controller: null,
        },
      });
    }
  };

  const processAttachmentQueue = async () => {
    const pending = attachmentQueue.filter((item) => item.status === "queued");
    if (!pending.length) return false;
    await Promise.all(pending.map((item) => startAttachmentUpload(item)));
    return attachmentQueue.some((item) => item.status === "error");
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
        setShowGifPicker(false);
      }
      if (quickActionsRef.current && !quickActionsRef.current.contains(event.target)) {
        setShowQuickActions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!data.chatId) return undefined;

    const handleDocumentPaste = (event) => {
      const activeElement = document.activeElement;
      const inTextField = activeElement && (activeElement.tagName === "TEXTAREA" || activeElement.tagName === "INPUT" || activeElement.isContentEditable);
      if (inTextField) return undefined;
      const files = Array.from(event.clipboardData?.files || []);
      if (!files.length) return undefined;
      event.preventDefault();
      handleFilesAdded(files);
      return undefined;
    };

    const handleDragEnter = (event) => {
      if (!event.dataTransfer || !event.dataTransfer.types?.includes("Files")) return;
      event.preventDefault();
      setIsDragOver(true);
    };

    const handleDragOver = (event) => {
      if (!event.dataTransfer || !event.dataTransfer.types?.includes("Files")) return;
      event.preventDefault();
      setIsDragOver(true);
    };

    const handleDragLeave = (event) => {
      if (!event.dataTransfer || !event.dataTransfer.types?.includes("Files")) return;
      const nextTarget = event.relatedTarget || null;
      if (nextTarget && (nextTarget === document.body || nextTarget === document.documentElement)) {
        setIsDragOver(false);
      }
    };

    const handleDrop = (event) => {
      if (!event.dataTransfer || !event.dataTransfer.types?.includes("Files")) return;
      event.preventDefault();
      setIsDragOver(false);
      handleFilesAdded(Array.from(event.dataTransfer.files || []));
    };

    document.addEventListener("paste", handleDocumentPaste);
    document.addEventListener("dragenter", handleDragEnter, true);
    document.addEventListener("dragover", handleDragOver, true);
    document.addEventListener("dragleave", handleDragLeave, true);
    document.addEventListener("drop", handleDrop, true);

    return () => {
      document.removeEventListener("paste", handleDocumentPaste);
      document.removeEventListener("dragenter", handleDragEnter, true);
      document.removeEventListener("dragover", handleDragOver, true);
      document.removeEventListener("dragleave", handleDragLeave, true);
      document.removeEventListener("drop", handleDrop, true);
    };
  }, [data.chatId, handleFilesAdded]);

  const notifyRecipients = async (recipientUids, body, chatId = data.chatId) => {
    if (recipientUids.length === 0) {
      console.warn("notify skipped: no recipients");
      return;
    }

    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error("You must be signed in to send notifications.");
      const requestNotification = async (forceRefresh) => {
        const idToken = await firebaseUser.getIdToken(forceRefresh);
        return fetch("/api/notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + idToken,
          },
          body: JSON.stringify({
            chatId,
            recipientUids,
            title: currentUser.displayName || "New message",
            body,
          }),
        });
      };
      let response = await requestNotification(false);
      if (response.status === 401) response = await requestNotification(true);

      if (!response.ok) {
        console.warn("notify failed", response.status, await response.text());
        return;
      }

      console.info("notify ok", await response.json());
    } catch (error) {
      console.warn("notify error", error);
    }
  };

  const forwardVoiceMessage = async (targetChatId, targetUser) => {
    if (!forwardingMessage || forwardingBusy) return;
    setForwardingBusy(true);
    setForwardingChatId(targetChatId);
    setForwardError("");

    try {
      const sourceAudio = forwardingMessage.audio || forwardingMessage.file;
      if (typeof sourceAudio?.url !== "string" || !sourceAudio.url) {
        throw new Error("This voice message no longer has an audio file to forward.");
      }

      let job = forwardJobsRef.current.get(targetChatId);
      if (!job) {
        const duration = Number.isFinite(sourceAudio.duration) ? Math.max(0, sourceAudio.duration) : 0;
        const sourcePeaks = sourceAudio.peaks;
        const peaks = Array.isArray(sourcePeaks) &&
          sourcePeaks.length === 40 &&
          sourcePeaks.every((peak) => Number.isInteger(peak) && peak >= 0 && peak <= 100)
          ? [...sourcePeaks]
          : emptyVoiceWaveform();
        const audio = {
          url: sourceAudio.url,
          duration,
          peaks,
          mime: sourceAudio.mime || sourceAudio.mimeType || sourceAudio.type || "",
          size: Number.isFinite(sourceAudio.size) ? sourceAudio.size : 0,
        };
        const messageText = `🎤 Voice message${duration > 0 ? ` (${compactVoiceDuration(duration)})` : ""}`;
        const createdAt = new Date();
        const payload = {
          id: uuid(),
          text: messageText,
          senderId: currentUser.uid,
          ...(currentUser.displayName ? { senderName: currentUser.displayName } : {}),
          ...(currentUser.photoURL ? { senderPhoto: currentUser.photoURL } : {}),
          date: Timestamp.fromDate(createdAt),
          type: "audio",
          audio: { ...audio },
        };
        job = {
          payload,
          targetUser,
          messageSaved: false,
          notified: false,
        };
        forwardJobsRef.current.set(targetChatId, job);
      }

      if (!job.messageSaved) {
        await writeChatMessages({
          chatId: targetChatId,
          messages: [job.payload],
          lastMessageText: job.payload.text,
          lastMessageType: "audio",
          chatUser: job.targetUser,
          sender: currentUser,
        });
        job.messageSaved = true;
      }

      if (!job.notified) {
        const recipientUids = job.targetUser?.isGroup
          ? (job.targetUser.members || []).map((member) => member.uid).filter((uid) => uid && uid !== currentUser.uid)
          : job.targetUser?.uid
            ? [job.targetUser.uid]
            : [];
        await notifyRecipients(recipientUids, "🎤 Voice message", targetChatId);
        job.notified = true;
      }

      setForwardingMessage(null);
    } catch (error) {
      console.error("Error forwarding voice message:", error);
      setForwardError(error.message || "Could not forward this voice message. Please try again.");
    } finally {
      setForwardingBusy(false);
      setForwardingChatId("");
    }
  };

  const finishVoicePreview = (result) => {
    voiceRecorderRef.current = null;
    voiceRecorderStartingRef.current = false;
    setVoiceElapsed(result.duration);
    if (result.duration < 1) {
      setVoiceStage("idle");
      setVoiceNotice("Hold on, too short.");
      setVoiceAnnouncement("Recording was too short.");
      return;
    }

    const preview = { ...result, url: URL.createObjectURL(result.blob) };
    voicePreviewRef.current = preview;
    setVoicePreview(preview);
    previewNeedsDurationFixRef.current = false;
    setPreviewTime(0);
    setVoiceNotice(voiceRecorderNoticeRef.current);
    voiceRecorderNoticeRef.current = "";
    setVoiceAnnouncement(`Recording stopped, ${compactVoiceDuration(result.duration)}`);
    setVoiceStage("preview");
  };

  const startVoiceRecording = async () => {
    if (voiceRecorderStartingRef.current || voiceRecorderRef.current || !data.chatId || !currentUser?.uid) return;
    if (!isVoiceSupported()) {
      const reason = typeof window !== "undefined" && !window.isSecureContext
        ? "Voice recording requires a secure HTTPS connection."
        : "Voice recording is not supported by this browser.";
      setVoiceNotice(reason);
      return;
    }

    voiceRecorderStartingRef.current = true;
    setVoiceNotice("");
    voiceRecorderNoticeRef.current = "";
    setVoiceAnnouncement("Waiting for microphone.");
    setVoiceStage("requesting");
    setVoiceElapsed(0);
    setVoiceWaveform(emptyVoiceWaveform());
    pauseActiveVoiceMessage();

    const recorder = new VoiceRecorder({
      onTick: ({ elapsed, level }) => {
        setVoiceElapsed(elapsed);
        setVoiceWaveform((current) => [...current.slice(-39), level]);
      },
      onError: (message) => {
        voiceRecorderNoticeRef.current = message;
        setVoiceNotice(message);
      },
      onComplete: finishVoicePreview,
    });
    voiceRecorderRef.current = recorder;
    try {
      await recorder.start();
      if (voiceRecorderRef.current !== recorder) return;
      voiceRecorderStartingRef.current = false;
      setVoiceStage("recording");
      setVoiceAnnouncement("Recording started.");
      if (process.env.NODE_ENV !== "production") {
        console.info("Voice recording started", { mimeType: recorder.recorder?.mimeType || "" });
      }
    } catch (error) {
      if (voiceRecorderRef.current !== recorder) return;
      voiceRecorderRef.current = null;
      voiceRecorderStartingRef.current = false;
      setVoiceStage("idle");
      setVoiceNotice(error?.message || "Could not start the microphone. Please try again.");
      setVoiceAnnouncement("Microphone could not be started.");
    }
  };

  const stopVoiceRecording = async (sendImmediately = false) => {
    const recorder = voiceRecorderRef.current;
    if (!recorder) return;
    voiceRecorderStartingRef.current = false;
    try {
      const result = await recorder.stop();
      if (voiceRecorderRef.current !== recorder || !result) return;
      if (sendImmediately) {
        voiceRecorderRef.current = null;
        if (result.duration < 1) {
          setVoiceStage("idle");
          setVoiceNotice("Hold on, too short.");
          setVoiceAnnouncement("Recording was too short.");
          return;
        }
        await sendVoiceRecording(result);
      } else {
        finishVoicePreview(result);
      }
    } catch (error) {
      if (voiceRecorderRef.current !== recorder) return;
      voiceRecorderRef.current = null;
      setVoiceStage("idle");
      setVoiceNotice(error?.message || "Could not stop the recording.");
    }
  };

  const buildVoiceReplyPayload = () => {
    const source = replyingTo || editingMessage;
    if (!source) return {};
    const sourceIsAudio = source.type === "audio" || Boolean(source.audio) || source.file?.mime?.startsWith("audio/");
    return {
      replyTo: {
        id: source.id || "",
        senderId: source.senderId || "",
        senderName: source.senderName || "User",
        text: String(source.text || "").slice(0, 100),
        type: sourceIsAudio ? "audio" : ["text", "gif", "image"].includes(source.type) ? source.type : "text",
        ...(sourceIsAudio && Number.isFinite(source.audio?.duration ?? source.file?.duration ?? source.duration)
          ? { duration: source.audio?.duration ?? source.file?.duration ?? source.duration }
          : {}),
      },
    };
  };

  const sendVoiceRecording = async (recording) => {
    if (!data.chatId || !currentUser?.uid || !recording?.blob) return;
    const messageId = uuid();
    const chatId = data.chatId;
    const optimisticDate = new Date();
    const duration = Math.round(recording.duration * 10) / 10;
    const mime = recording.mime || recording.blob.type || "";
    const extension = getVoiceFileExtension(mime);
    const file = new File(
      [recording.blob],
      `voice-${optimisticDate.getTime()}${extension ? `.${extension}` : ""}`,
      { type: mime }
    );
    const localUrl = voicePreviewRef.current?.blob === recording.blob
      ? voicePreviewRef.current.url
      : recording.url || URL.createObjectURL(recording.blob);
    const replyPayload = buildVoiceReplyPayload();
    const lastMessageText = `🎤 Voice message (${compactVoiceDuration(duration)})`;
    const job = {
      chatId,
      localUrl,
      file,
      recording,
      uploaded: null,
      controller: null,
      cancelled: false,
      messageCommitted: false,
      notified: false,
      payloadDate: Timestamp.fromDate(optimisticDate),
      replyPayload,
    };
    const cancelUpload = () => {
      job.cancelled = true;
      job.controller?.abort();
      pendingMessagesStore.removeMessage(chatId, messageId);
      URL.revokeObjectURL(localUrl);
    };

    const deleteVoiceMessage = async () => {
      if (job.messageCommitted) {
        try {
          const chatRef = doc(db, "chats", chatId);
          await runTransaction(db, async (transaction) => {
            const chatSnap = await transaction.get(chatRef);
            if (!chatSnap.exists()) return;
            const messages = Array.isArray(chatSnap.data().messages)
              ? chatSnap.data().messages
              : [];
            transaction.update(chatRef, {
              messages: messages.filter((message) => message.id !== messageId),
            });
          });
        } catch (error) {
          console.error("Error deleting failed voice message:", error);
          pendingMessagesStore.updateMessage(chatId, messageId, {
            error: "Could not delete the failed voice message. Please try again.",
          });
          return;
        }
      }
      cancelUpload();
    };

    const retryUpload = () => {
      job.cancelled = false;
      if (voiceOwnerRef.current.chatId === chatId && voiceOwnerRef.current.uid === currentUser.uid) {
        setVoiceStage("uploading");
        setVoiceAnnouncement("Retrying voice message upload.");
      }
      return uploadAndSend();
    };

    const optimisticMessage = {
      id: messageId,
      text: "🎤 Voice message",
      senderId: currentUser.uid,
      ...(currentUser.displayName ? { senderName: currentUser.displayName } : {}),
      ...(currentUser.photoURL ? { senderPhoto: currentUser.photoURL } : {}),
      date: optimisticDate,
      type: "audio",
      audio: { url: localUrl, duration, peaks: recording.peaks, mime, size: recording.blob.size },
      localUrl,
      status: "uploading",
      uploadProgress: 0,
      retry: retryUpload,
      cancel: cancelUpload,
      delete: deleteVoiceMessage,
      ...replyPayload,
    };
    pendingMessagesStore.addMessage(chatId, optimisticMessage);
    voicePreviewRef.current = null;
    setVoicePreview(null);
    setPreviewTime(0);
    setVoiceNotice("");
    setVoiceAnnouncement("Uploading voice message.");
    setVoiceStage("uploading");
    setReplyingTo(null);
    setEditingMessage(null);
    inputRef.current?.focus();

    const uploadAndSend = async () => {
      if (job.cancelled) return;
      const updatePending = (changes) => pendingMessagesStore.updateMessage(chatId, messageId, changes);
      job.controller = new AbortController();
      updatePending({ status: "uploading", uploadProgress: 0, error: "" });
      try {
        if (!navigator.onLine) throw new Error("You are offline. Reconnect and retry this voice message.");
        if (recording.blob.size > MAX_AUDIO_MB * 1024 * 1024) {
          throw new Error(`Voice messages must be ${MAX_AUDIO_MB} MB or smaller.`);
        }
        if (!job.uploaded) {
          job.uploaded = await uploadFile(file, {
            folder: "chathere/chat",
            resourceType: "video",
            signal: job.controller.signal,
            onProgress: (progress) => updatePending({ uploadProgress: progress }),
          });
          if (process.env.NODE_ENV !== "production") {
            console.info("Voice upload completed", {
              mimeType: mime,
              blobSize: recording.blob.size,
              duration,
              cloudinaryResponseSize: job.uploaded.bytes,
            });
          }
        }

        if (job.cancelled) return;
        updatePending({ status: "sending", uploadProgress: 100 });
        const audio = {
          url: job.uploaded.url,
          duration,
          peaks: recording.peaks,
          mime,
          size: Number.isFinite(job.uploaded.bytes) ? job.uploaded.bytes : recording.blob.size,
        };
        const payload = {
          id: messageId,
          text: lastMessageText,
          senderId: currentUser.uid,
          ...(currentUser.displayName ? { senderName: currentUser.displayName } : {}),
          ...(currentUser.photoURL ? { senderPhoto: currentUser.photoURL } : {}),
          date: job.payloadDate,
          type: "audio",
          audio,
          ...replyPayload,
        };
        if (!job.messageCommitted) {
          await writeChatMessages({
            chatId,
            messages: [payload],
            lastMessageText,
            lastMessageType: "audio",
            chatUser: data.user,
            sender: currentUser,
          });
          job.messageCommitted = true;
          }
        const recipientUids = data.user?.isGroup
          ? (data.user.members || []).map((member) => member.uid).filter((uid) => uid && uid !== currentUser.uid)
          : data.user?.uid
            ? [data.user.uid]
            : [];
        if (!job.notified) {
          void notifyRecipients(recipientUids, "🎤 Voice message");
          job.notified = true;
        }
        updatePending({ status: "sending", audio, text: lastMessageText, uploadProgress: 100 });
        URL.revokeObjectURL(localUrl);
        setVoiceAnnouncement(`Voice message sent, ${compactVoiceDuration(duration)}.`);
        if (voiceStateRef.current === "uploading") {
          setVoiceStage("sent");
          window.setTimeout(() => {
            if (voiceStateRef.current === "sent") setVoiceStage("idle");
          }, 700);
        }
      } catch (error) {
        if (job.cancelled) return;
        job.controller = null;
        updatePending({
          status: "failed",
          error: error?.message || "Voice message upload failed.",
          uploadProgress: 0,
          retry: retryUpload,
          cancel: cancelUpload,
          delete: deleteVoiceMessage,
        });
        setVoiceAnnouncement("Voice message failed to send.");
        if (voiceStateRef.current === "uploading") {
          setVoiceStage("failed");
          window.setTimeout(() => {
            if (voiceStateRef.current === "failed") setVoiceStage("idle");
          }, 1200);
        }
      }
    };

    await uploadAndSend();
  };

  const sendVoicePreview = async () => {
    const preview = voicePreviewRef.current;
    if (!preview) return;
    previewAudioRef.current?.pause();
    await sendVoiceRecording(preview);
  };

  const seekVoicePreview = (event) => {
    const audio = previewAudioRef.current;
    const bounds = previewSliderRef.current?.getBoundingClientRect();
    if (!audio || !bounds || !voicePreview) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const nextTime = fraction * voicePreview.duration;
    audio.currentTime = nextTime;
    setPreviewTime(nextTime);
  };

  const handleSend = async () => {
    if (sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    try {
      await performSend();
    } finally {
      sendInFlightRef.current = false;
    }
  };

  const performSend = async () => {
    const msgText = text.trim();
    if (!data.chatId) return;

    if (attachmentQueue.length > 0) {
      if (attachmentQueue.some((item) => item.status === "compressing")) return;
      const invalidItems = attachmentQueue.filter((item) => item.status === "blocked" || item.status === "error");
      if (invalidItems.length > 0) {
        return;
      }

      const queuedItems = attachmentQueue.filter((item) => item.status === "queued");
      const uploadingItems = attachmentQueue.filter((item) => item.status === "uploading");
      if (uploadingItems.length > 0 || queuedItems.length > 0) {
        if (queuedItems.length > 0) {
          const failedUploads = await processAttachmentQueue();
          if (failedUploads) return;
        }
        return;
      }

      const doneItems = attachmentQueue.filter((item) => item.status === "done");
      if (doneItems.length === 0) return;

      const basePayloads = doneItems.map((item, index) => {
        const file = item.file;
        const mime = file.type || "application/octet-stream";
        const result = item.result || {};
        const caption = index === 0 && msgText ? msgText : "";
        const defaultText = mime.startsWith("image/") ? "📷 Photo" : `📎 ${file.name || "file"}`;

        if (file.type?.startsWith("image/")) {
          const width = typeof result.width === "number" ? result.width : item.compressed?.width;
          const height = typeof result.height === "number" ? result.height : item.compressed?.height;
          return {
            id: uuid(),
            text: caption || defaultText,
            img: result.url || file.name,
            senderId: currentUser.uid,
            senderName: currentUser.displayName,
            senderPhoto: currentUser.photoURL,
            date: Timestamp.fromDate(new Date()),
            type: "image",
            ...(typeof width === "number" ? { width } : {}),
            ...(typeof height === "number" ? { height } : {}),
            ...(item.hd ? { hd: true } : {}),
            ...getReplyPayload(),
          };
        }

        if (file.type?.startsWith("video/")) {
          return {
            id: uuid(),
            text: caption || defaultText,
            senderId: currentUser.uid,
            senderName: currentUser.displayName,
            senderPhoto: currentUser.photoURL,
            date: Timestamp.fromDate(new Date()),
            type: "video",
            file: {
              url: result.url || "",
              name: file.name,
              size: file.size,
              mime,
              resourceType: result.resourceType || "video",
              ...(Number.isFinite(result.width) ? { width: result.width } : {}),
              ...(Number.isFinite(result.height) ? { height: result.height } : {}),
            },
            ...getReplyPayload(),
          };
        }

        return {
          id: uuid(),
          text: caption || defaultText,
          senderId: currentUser.uid,
          senderName: currentUser.displayName,
          senderPhoto: currentUser.photoURL,
          date: Timestamp.fromDate(new Date()),
          type: "file",
          file: {
            url: result.url || "",
            name: file.name,
            size: file.size,
            mime,
            resourceType: result.resourceType || "raw",
          },
          ...getReplyPayload(),
        };
      });

      try {
        const messageBody = basePayloads[0]?.text || "📎 File";
        await writeChatMessages({
          chatId: data.chatId,
          messages: basePayloads,
          lastMessageText: messageBody,
          lastMessageType: basePayloads[0]?.type,
          chatUser: data.user,
          sender: currentUser,
        });
        const recipientUids = data.user?.isGroup
          ? (data.user.members || []).map((member) => member.uid).filter((uid) => uid && uid !== currentUser.uid)
          : data.user?.uid
          ? [data.user.uid]
          : [];
        void notifyRecipients(recipientUids, messageBody);
      } catch (error) {
        console.error("Error sending attachment message:", error);
        setVoiceNotice(error?.message || "Could not send this attachment. Please try again.");
        return;
      }

      setText("");
      setReplyingTo(null);
      setEditingMessage(null);
      clearDraft();
      attachmentQueue.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      dispatchAttachments({ type: "clear" });
      stopTyping();
      inputRef.current?.focus();
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    if (editingMessage) {
      if (!msgText) {
        setEditingMessage(null);
        clearDraft();
        return;
      }

      try {
        const chatRef = doc(db, "chats", data.chatId);
        const memberUids = data.user?.isGroup
          ? (data.user.members || []).map((member) => member.uid).filter(Boolean)
          : data.user?.uid
          ? [data.user.uid, currentUser.uid]
          : [currentUser.uid];

        await runTransaction(db, async (transaction) => {
          const chatSnap = await transaction.get(chatRef);
          if (!chatSnap.exists()) return;

          const messages = chatSnap.data().messages || [];
          const updatedMessages = messages.map((message) =>
            message.id === editingMessage.id
              ? { ...message, text: msgText, edited: true, editedAt: Date.now() }
              : message
          );
          transaction.update(chatRef, { messages: updatedMessages });

          const isLatestMessage = messages[messages.length - 1]?.id === editingMessage.id;
          if (isLatestMessage) {
            for (const uid of [...new Set(memberUids)]) {
              const userChatsRef = doc(db, "userChats", uid);
              const userChatSnap = await transaction.get(userChatsRef);
              if (!userChatSnap.exists()) continue;
              const userChatsData = userChatSnap.data() || {};
              const chatEntry = userChatsData[data.chatId];
              if (!chatEntry || !chatEntry.lastMessage) continue;
              transaction.update(userChatsRef, {
              }, new FieldPath(data.chatId, "lastMessage", "text"), msgText);
            }
          }
        });
      } catch (error) {
        console.error("Error editing message:", error);
        setVoiceNotice(error?.message || "Could not save this edit. Please try again.");
        return;
      }

      setEditingMessage(null);
      clearDraft();
      stopTyping();
      inputRef.current?.focus();
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    if (!msgText) return;

    setReplyingTo(null);
    clearDraft();
    stopTyping();
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.focus());

    const msgId = uuid();
    const optimisticDate = new Date();

    const optimisticMsg = {
      id: msgId,
      text: msgText,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      senderPhoto: currentUser.photoURL,
      date: optimisticDate,
      status: "sending",
      ...getReplyPayload(),
    };

    pendingMessagesStore.addMessage(data.chatId, optimisticMsg);

    await (async () => {
      try {
        const payload = {
          id: msgId,
          text: msgText,
          senderId: currentUser.uid,
          senderName: currentUser.displayName,
          senderPhoto: currentUser.photoURL,
          date: Timestamp.fromDate(optimisticDate),
          ...getReplyPayload(),
        };

        await writeChatMessages({
          chatId: data.chatId,
          messages: [payload],
          lastMessageText: msgText,
          chatUser: data.user,
          sender: currentUser,
        });

        const recipientUids = data.user?.isGroup
          ? (data.user.members || [])
              .map((member) => member.uid)
              .filter((uid) => uid && uid !== currentUser.uid)
          : data.user?.uid
          ? [data.user.uid]
          : [];

        void notifyRecipients(recipientUids, msgText);
      } catch (error) {
        console.error("Error sending message:", error);
        pendingMessagesStore.updateMessageStatus(data.chatId, msgId, "failed");
      }
    })();
  };

  const handleGifSend = async (gifUrl, gif = {}) => {
    if (!data.chatId || sendInFlightRef.current) return;
    sendInFlightRef.current = true;
    setShowGifPicker(false);
    const msgText = text.trim();
    setText("");
    setReplyingTo(null);
    stopTyping();
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.focus());

    const msgId = uuid();
    const optimisticDate = new Date();

    const optimisticMsg = {
      id: msgId,
      text: msgText,
      img: gifUrl,
      type: "gif",
      ...(Number.isFinite(gif.width) ? { width: gif.width } : {}),
      ...(Number.isFinite(gif.height) ? { height: gif.height } : {}),
      ...(gif.gifPreview ? { gifPreview: gif.gifPreview } : {}),
      ...(gif.gifMp4 ? { gifMp4: gif.gifMp4 } : {}),
      ...(gif.gifWebm ? { gifWebm: gif.gifWebm } : {}),
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      senderPhoto: currentUser.photoURL,
      date: optimisticDate,
      status: "sending",
      ...getReplyPayload(),
    };

    pendingMessagesStore.addMessage(data.chatId, optimisticMsg);

    try {
      await (async () => {
      try {
        const payload = {
          id: msgId,
          text: msgText,
          senderId: currentUser.uid,
          senderName: currentUser.displayName,
          senderPhoto: currentUser.photoURL,
          date: Timestamp.fromDate(optimisticDate),
          img: gifUrl,
          type: "gif",
          ...(Number.isFinite(gif.width) ? { width: gif.width } : {}),
          ...(Number.isFinite(gif.height) ? { height: gif.height } : {}),
          ...(gif.gifPreview ? { gifPreview: gif.gifPreview } : {}),
          ...(gif.gifMp4 ? { gifMp4: gif.gifMp4 } : {}),
          ...(gif.gifWebm ? { gifWebm: gif.gifWebm } : {}),
          ...getReplyPayload(),
        };

        await writeChatMessages({
          chatId: data.chatId,
          messages: [payload],
          lastMessageText: msgText || "Sent a GIF",
          lastMessageType: "gif",
          chatUser: data.user,
          sender: currentUser,
        });

        const recipientUids = data.user?.isGroup
          ? (data.user.members || [])
              .map((member) => member.uid)
              .filter((uid) => uid && uid !== currentUser.uid)
          : data.user?.uid
          ? [data.user.uid]
          : [];

        void notifyRecipients(recipientUids, "GIF");
      } catch (err) {
        console.error("Error sending GIF:", err);
        pendingMessagesStore.updateMessageStatus(data.chatId, msgId, "failed");
      }
      })();
    } finally {
      sendInFlightRef.current = false;
    }
  };

  const handleImageSelect = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    handleFilesAdded(files);
  };

  const handleTextareaPaste = (event) => {
    const files = Array.from(event.clipboardData?.files || []);
    if (!files.length) return;
    event.preventDefault();
    handleFilesAdded(files);
  };

  const handleKeyDown = (e) => {
    if (e.isComposing) return;

    if (e.key === "Escape") {
      if (replyingTo) {
        e.preventDefault();
        setReplyingTo(null);
        return;
      }
      if (editingMessage) {
        e.preventDefault();
        setEditingMessage(null);
        if (data.chatId) {
          const nextDraft = draftsRef.current[data.chatId] ?? "";
          setText(nextDraft);
        }
        return;
      }
    }

    if (e.key === "ArrowUp" && !text.trim() && !replyingTo && !editingMessage && data.chatId) {
      e.preventDefault();
      const chatRef = doc(db, "chats", data.chatId);
      getDoc(chatRef).then((snap) => {
        if (!snap.exists()) return;
        const messages = snap.data().messages || [];
        const lastOwnText = [...messages].reverse().find(
          (message) => message.senderId === currentUser.uid && typeof message.text === "string" && message.text.trim()
        );
        if (!lastOwnText) return;
        setEditingMessage(lastOwnText);
        const nextValue = lastOwnText.text || "";
        draftsRef.current[data.chatId] = nextValue;
        setText(nextValue);
      }).catch((error) => console.error("Could not load the previous message for editing:", error));
      return;
    }

    const enterToSendPreference = (() => {
      if (typeof window === "undefined") return true;
      const saved = window.localStorage.getItem("chathere:enterToSend");
      return saved === null ? !window.matchMedia("(pointer: coarse)").matches : saved === "true";
    })();

    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && enterToSendPreference) {
      e.preventDefault();
      handleSend();
    }
  };

  const onEmojiClick = (emojiObject) => {
    const nextValue = `${text}${emojiObject.emoji}`;
    persistDraft(nextValue);
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.focus());

    if (data.chatId) {
    markTyping();
    }
  };

  const handleTyping = (e) => {
    const nextValue = e.target.value;
    persistDraft(nextValue);

    markTyping();
  };

  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCanHover(window.matchMedia("(hover: hover)").matches);
    }
  }, []);

  const imageItems = attachmentQueue.filter((item) => item.file.type?.startsWith("image/"));
  const hdCapableImageItems = imageItems.filter((item) => isHdCapableImage(item.file));
  const allImagesHd = hdCapableImageItems.length > 0 && hdCapableImageItems.every((item) => item.hd);
  const mixedImageHd = hdCapableImageItems.some((item) => item.hd) && !allImagesHd;
  const voiceSupported = isVoiceSupported();
  const voiceSupportMessage = typeof window !== "undefined" && !window.isSecureContext
    ? "Voice recording requires a secure HTTPS connection."
    : "Voice recording is not supported by this browser.";
  const voiceComposerActive = ["requesting", "recording", "preview"].includes(voiceState);
  const hasComposerContent = Boolean(text.trim() || attachmentQueue.length);
  const forwardTargets = Object.entries(userChats || {})
    .filter(([, chat]) => chat?.userInfo?.isGroup || chat?.userInfo?.uid)
    .sort(([, first], [, second]) =>
      (first.userInfo.displayName || first.userInfo.name || "").localeCompare(second.userInfo.displayName || second.userInfo.name || "")
    );

  useEffect(() => {
    if (text.trim() || attachmentQueue.length > 0) setShowQuickActions(false);
  }, [attachmentQueue.length, text]);

  return (
    <div
      className="chat-composer-shell"
    >
      <AnimatePresence>
        {(replyingTo || editingMessage) && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: 6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className={`glass mb-2 flex items-center gap-2 rounded-2xl px-3 py-2 ${editingMessage ? "composer-context-edit" : "composer-context-reply"}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[var(--primary-text)]">
                  {editingMessage ? "Editing message" : `Replying to ${replyingTo?.senderName || "User"}`}
                </p>
                <p className="truncate text-xs text-[var(--text-secondary)]">
                  {editingMessage
                    ? editingMessage.text || "Message"
                    : replyingTo?.type === "image"
                      ? "📷 Photo"
                      : replyingTo?.type === "gif"
                        ? "GIF"
                        : replyingTo?.type === "audio"
                          ? `🎤 Voice message${Number.isFinite(replyingTo.duration) ? ` ${compactVoiceDuration(replyingTo.duration)}` : ""}`
                        : replyingTo?.text || "Message"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (editingMessage) {
                    setEditingMessage(null);
                    const nextDraft = data.chatId ? draftsRef.current[data.chatId] ?? "" : "";
                    setText(nextDraft);
                    return;
                  }
                  setReplyingTo(null);
                }}
                className="icon-btn flex-shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                aria-label={editingMessage ? "Cancel edit" : "Cancel reply"}
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-end gap-2">
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

        <div ref={pickerRef} className="composer-pill glass glass-pill relative flex min-h-12 min-w-0 flex-1 items-center px-1.5 py-1">
          <AnimatePresence initial={false} mode="wait">
            {voiceComposerActive ? (
              <motion.div
                key="voice-composer"
                layout={!shouldReduceMotion}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.14 }}
                className="flex min-h-11 w-full min-w-0 items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => cancelVoiceRecording()}
                  className="icon-btn-glass min-h-11 min-w-11 shrink-0 border-0 bg-transparent text-[var(--danger-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  aria-label={voiceState === "preview" ? "Discard voice message" : "Cancel recording"}
                  title={voiceState === "preview" ? "Discard recording" : "Cancel recording"}
                >
                  <Trash2 size={18} />
                </button>
                {voiceState === "requesting" ? (
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-[var(--text-secondary)]" role="status">
                    <Loader2 size={16} className={shouldReduceMotion ? "" : "animate-spin"} aria-hidden="true" />
                    <span className="truncate">Waiting for microphone...</span>
                  </div>
                ) : voiceState === "recording" ? (
                  <>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--danger-text)] ${shouldReduceMotion ? "" : "animate-pulse"}`} aria-label="Recording" />
                    <span className={`shrink-0 font-mono text-sm tabular-nums ${voiceElapsed >= 270 ? "text-[var(--danger-text)]" : "text-[var(--text-primary)]"}`}>
                      {compactVoiceDuration(voiceElapsed)}
                    </span>
                    <div className="flex h-9 min-w-0 flex-1 items-center justify-between gap-[2px] overflow-hidden" aria-label="Live recording waveform">
                      {voiceWaveform.map((level, index) => (
                        <span
                          key={index}
                          className="min-w-[2px] flex-1 rounded-full bg-[var(--primary)]"
                          style={{
                            height: shouldReduceMotion ? "12px" : "32px",
                            transform: shouldReduceMotion
                              ? "none"
                              : `scaleY(${Math.max(0.125, Math.min(1, level / 100))})`,
                            transformOrigin: "center",
                          }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => stopVoiceRecording(false)}
                      className="icon-btn-glass min-h-11 min-w-11 shrink-0 border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      aria-label="Stop recording and preview"
                      title="Stop recording"
                    >
                      <Square size={18} fill="currentColor" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const audio = previewAudioRef.current;
                        if (!audio) return;
                        if (audio.paused) audio.play().catch(() => setVoiceNotice("Could not play the recording preview."));
                        else audio.pause();
                      }}
                      className="icon-btn-glass min-h-11 min-w-11 shrink-0 border-0 bg-transparent text-[var(--primary-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      aria-label={previewPlaying ? "Pause recording preview" : "Play recording preview"}
                    >
                      {previewPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                    </button>
                    <div
                      ref={previewSliderRef}
                      role="slider"
                      tabIndex={0}
                      aria-label="Recording preview position"
                      aria-valuemin={0}
                      aria-valuemax={Math.round(voicePreview?.duration || 0)}
                      aria-valuenow={Math.round(previewTime)}
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        seekVoicePreview(event);
                      }}
                      onPointerMove={(event) => {
                        if (event.buttons) seekVoicePreview(event);
                      }}
                      onPointerUp={seekVoicePreview}
                      onKeyDown={(event) => {
                        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
                        event.preventDefault();
                        const step = event.key === "ArrowRight" ? 5 : -5;
                        const audio = previewAudioRef.current;
                        if (!audio || !voicePreview) return;
                        const nextTime = Math.max(0, Math.min(voicePreview.duration, audio.currentTime + step));
                        audio.currentTime = nextTime;
                        setPreviewTime(nextTime);
                      }}
                      className="flex h-11 min-w-0 flex-1 cursor-pointer items-center gap-[2px] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                      style={{ touchAction: "none" }}
                    >
                      {(voicePreview?.peaks || emptyVoiceWaveform()).map((peak, index) => (
                        <span
                          key={index}
                          className="min-w-[2px] flex-1 rounded-full"
                          style={{
                            height: `${Math.max(4, Math.min(30, peak * 0.3))}px`,
                            background: index / 40 < (voicePreview?.duration ? previewTime / voicePreview.duration : 0)
                              ? "var(--primary)"
                              : "var(--text-muted)",
                            opacity: index / 40 < (voicePreview?.duration ? previewTime / voicePreview.duration : 0) ? 1 : 0.55,
                          }}
                        />
                      ))}
                    </div>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
                      {compactVoiceDuration(voicePreview?.duration || 0)}
                    </span>
                    <audio
                      ref={previewAudioRef}
                      src={voicePreview?.url}
                      preload="auto"
                      onLoadedMetadata={(event) => {
                        if (!Number.isFinite(event.currentTarget.duration)) {
                          previewNeedsDurationFixRef.current = true;
                          try {
                            event.currentTarget.currentTime = 1e101;
                          } catch {
                            previewNeedsDurationFixRef.current = false;
                            setVoiceNotice("Could not prepare recording duration; the saved duration will be used.");
                          }
                        }
                      }}
                      onDurationChange={(event) => {
                        if (previewNeedsDurationFixRef.current && Number.isFinite(event.currentTarget.duration)) {
                          try {
                            event.currentTarget.currentTime = 0;
                          } catch {
                            setVoiceNotice("Could not seek this preview; you can still send the recording.");
                          }
                          previewNeedsDurationFixRef.current = false;
                          setPreviewTime(0);
                        }
                      }}
                      onTimeUpdate={(event) => {
                        if (!previewNeedsDurationFixRef.current) setPreviewTime(event.currentTarget.currentTime);
                      }}
                      onPlay={(event) => {
                        setPreviewPlaying(true);
                        activateVoiceMessage("local-preview", event.currentTarget);
                      }}
                      onPause={(event) => {
                        setPreviewPlaying(false);
                        deactivateVoiceMessage(event.currentTarget);
                      }}
                      onEnded={(event) => {
                        setPreviewPlaying(false);
                        setPreviewTime(0);
                        deactivateVoiceMessage(event.currentTarget);
                      }}
                      onError={() => setVoiceNotice("Could not load the recording preview. You can still send it or discard it.")}
                      className="hidden"
                      aria-label="Voice message preview"
                    />
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="message-composer"
                layout={!shouldReduceMotion}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.14 }}
                className="flex min-h-11 w-full min-w-0 items-end gap-1"
              >
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    if (showEmojiPicker || showGifPicker) {
                      setShowEmojiPicker(false);
                      setShowGifPicker(false);
                    } else {
                      setShowEmojiPicker(true);
                    }
                  }}
                  className={`icon-btn-glass min-h-11 min-w-11 shrink-0 border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${showEmojiPicker ? "text-[var(--primary-text)]" : ""}`}
                  aria-label="Emoji and sticker picker"
                  title="Emoji and sticker picker"
                  onPointerEnter={() => {
                    import("./GifPicker").catch((error) => console.error("Could not preload GIF picker:", error));
                  }}
                  onFocus={() => {
                    import("./GifPicker").catch((error) => console.error("Could not preload GIF picker:", error));
                  }}
                  onTouchStart={() => {
                    import("./GifPicker").catch((error) => console.error("Could not preload GIF picker:", error));
                  }}
                >
                  <Smile size={19} />
                </button>

                <div className="relative flex min-h-11 min-w-0 flex-1 items-end">
                  <AnimatePresence>
                    {(showEmojiPicker || showGifPicker) && (
                      <motion.div
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                        className="glass absolute bottom-full left-0 z-50 mb-2 overflow-hidden p-1"
                      >
                        <div className="flex gap-1 border-b border-[var(--border)] p-1">
                          <button type="button" onClick={() => { setShowEmojiPicker(true); setShowGifPicker(false); }} className={`chip min-h-11 flex-1 justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${showEmojiPicker ? "chip-active" : ""}`}>Emoji</button>
                          <button type="button" onClick={() => { setShowEmojiPicker(false); setShowGifPicker(true); }} className={`chip min-h-11 flex-1 justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${showGifPicker ? "chip-active" : ""}`}>GIF / Sticker</button>
                        </div>
                        {showEmojiPicker ? (
                          <div className="emoji-picker-ember">
                            <Suspense fallback={<div className="h-[380px] w-[300px] animate-pulse bg-[var(--surface-2)]" aria-label="Loading emoji picker" />}>
                              <EmojiPicker
                                onEmojiClick={onEmojiClick}
                                width={300}
                                height={380}
                                theme={theme === "dark" ? "dark" : "light"}
                                lazyLoadEmojis
                              />
                            </Suspense>
                          </div>
                        ) : (
                          <Suspense fallback={<div className="h-[380px] w-[300px] animate-pulse bg-[var(--surface-2)]" aria-label="Loading GIF picker" />}>
                            <GifPicker onGifSelect={handleGifSend} />
                          </Suspense>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    placeholder="Type here"
                    value={text}
                    onChange={handleTyping}
                    onBlur={stopTyping}
                    onKeyDown={handleKeyDown}
                    onPaste={handleTextareaPaste}
                    className="chat-input composer-textarea w-full resize-none"
                    id="chat-message-input"
                    aria-label="Message input"
                    style={{
                      minHeight: "36px",
                      maxHeight: "160px",
                      overflowY: text && inputRef.current && inputRef.current.scrollHeight > 160 ? "auto" : "hidden",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => imageInputRef.current?.click()}
                  className="icon-btn-glass min-h-11 min-w-11 shrink-0 border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  aria-label="Add photo"
                  title="Add photo"
                >
                  <ImageIcon size={18} />
                </button>
                <div className="relative shrink-0" ref={quickActionsRef}>
                  <button
                    type="button"
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => setShowQuickActions((open) => !open)}
                    className="icon-btn-glass min-h-11 min-w-11 border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                    aria-label="More message actions"
                    aria-expanded={showQuickActions}
                    aria-haspopup="menu"
                    title="More message actions"
                  >
                    <Plus size={19} />
                  </button>
                  <AnimatePresence>
                    {showQuickActions && (
                      <motion.div
                        role="menu"
                        aria-label="Message actions"
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
                        transition={{ duration: shouldReduceMotion ? 0 : 0.14 }}
                        className="glass quick-action-menu absolute bottom-full right-0 z-50 mb-2 w-48 p-1.5"
                      >
                        <button type="button" role="menuitem" className="quick-action-row min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" onClick={() => { setShowQuickActions(false); queueInputRef.current?.click(); }}>
                          <Paperclip size={16} /> File
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <input
          ref={queueInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            handleFilesAdded(event.target.files || []);
            event.target.value = "";
          }}
          aria-label="Attach files"
        />

        <AnimatePresence initial={false} mode="wait">
          {voiceState === "requesting" ? (
            <motion.button
              key="voice-requesting"
              type="button"
              disabled
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.14 }}
              className="send-btn h-12 w-12 flex-shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label="Waiting for microphone"
            >
              <Loader2 size={18} className={shouldReduceMotion ? "" : "animate-spin"} />
            </motion.button>
          ) : voiceState === "recording" || voiceState === "preview" ? (
            <motion.button
              key="voice-send"
              type="button"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.14 }}
              whileHover={canHover && !shouldReduceMotion ? { scale: 1.05 } : undefined}
              whileTap={!shouldReduceMotion ? { scale: 0.95 } : undefined}
              onClick={() => (voiceState === "recording" ? stopVoiceRecording(true) : sendVoicePreview())}
              className="send-btn h-12 w-12 flex-shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label="Send voice message"
              style={{ touchAction: "manipulation" }}
            >
              <Send size={18} className="ml-0.5" />
            </motion.button>
          ) : hasComposerContent ? (
            <motion.button
              key="send"
              type="button"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.14 }}
              whileHover={canHover && !shouldReduceMotion ? { scale: 1.05 } : undefined}
              whileTap={!shouldReduceMotion ? { scale: 0.95 } : undefined}
              onClick={handleSend}
              disabled={attachmentQueue.some((item) => item.status === "compressing" || item.status === "uploading")}
              className="send-btn h-12 w-12 flex-shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              id="chat-send-btn"
              aria-label="Send message"
              style={{ touchAction: "manipulation" }}
            >
              <Send size={18} className="ml-0.5" />
            </motion.button>
          ) : (
            <motion.button
              key="voice-mic"
              type="button"
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.14 }}
              whileHover={canHover && voiceSupported && !shouldReduceMotion ? { scale: 1.05 } : undefined}
              whileTap={voiceSupported && !shouldReduceMotion ? { scale: 0.95 } : undefined}
              onClick={startVoiceRecording}
              disabled={!voiceSupported}
              className="send-btn h-12 w-12 flex-shrink-0 rounded-full disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label={voiceSupported ? "Record voice message" : voiceSupportMessage}
              title={voiceSupported ? "Record voice message" : voiceSupportMessage}
              style={{ touchAction: "manipulation" }}
            >
              <Mic size={19} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{voiceAnnouncement}</p>
      {voiceNotice && <p className="px-2 pt-1 text-xs text-[var(--text-secondary)]" role="status">{voiceNotice}</p>}

      {attachmentQueue.length > 0 && (
        <div className="mt-3 space-y-2">
          {attachmentQueue.length === 1 && attachmentQueue[0]?.file?.type?.startsWith("image/") && attachmentQueue[0].status !== "blocked" && (
            <div className="glass rounded-2xl p-2">
              <div className="relative">
                <LazyImage src={attachmentQueue[0].previewUrl || attachmentQueue[0].result?.url} alt="Attachment preview" width={320} height={180} className="h-36 w-full rounded-xl" />
                {attachmentQueue[0].status === "compressing" && <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30"><Loader2 size={22} className="animate-spin text-white" aria-label="Compressing image" /></div>}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>{attachmentQueue[0].file.name || "Image"}</p>
                  <p className={`text-[11px] ${!attachmentQueue[0].hd && attachmentQueue[0].compressed && !attachmentQueue[0].compressionSkipped ? "text-[var(--success-text)]" : "text-[var(--text-secondary)]"}`}>
                    {getImageSizeLabel(attachmentQueue[0])}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {isHdCapableImage(attachmentQueue[0].file) && (
                    <button type="button" onClick={() => setAttachmentHd(attachmentQueue[0].id, !attachmentQueue[0].hd)} aria-pressed={attachmentQueue[0].hd} title="Send original quality (uses more storage)" className={`rounded-md border px-2 py-1 text-[10px] font-bold ${attachmentQueue[0].hd ? "border-[var(--primary-border)] bg-[var(--primary)] text-[var(--on-primary)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}>HD</button>
                  )}
                  <button type="button" onClick={() => removeAttachment(attachmentQueue[0].id)} className="text-xs font-semibold text-[var(--danger-text)]">Remove</button>
                  <button type="button" onClick={handleSend} disabled={attachmentQueue[0].status === "compressing" || attachmentQueue[0].status === "uploading" || attachmentQueue[0].status === "error"} className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-[var(--on-primary)] disabled:opacity-50">Send</button>
                </div>
              </div>
            </div>
          )}

          {imageItems.length >= 2 && (
            <div className="flex items-center justify-between gap-3 px-1">
              <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Attachments</span>
              <button
                type="button"
                onClick={() => setAllImagesHd(!allImagesHd)}
                aria-pressed={mixedImageHd ? "mixed" : allImagesHd}
                title="Send original quality (uses more storage)"
                className={`rounded-md border px-2 py-1 text-[10px] font-bold ${allImagesHd ? "border-[var(--primary-border)] bg-[var(--primary)] text-[var(--on-primary)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}
              >
                HD all{mixedImageHd ? " ·" : ""}
              </button>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {attachmentQueue.map((item) => {
              const icon = item.file.type?.startsWith("image/")
                ? <ImageIcon size={16} />
                : item.file.type?.startsWith("video/")
                  ? <Video size={16} />
                  : item.file.type?.startsWith("audio/")
                    ? <Music4 size={16} />
                    : <FileText size={16} />;

              const hasPreview = item.file.type?.startsWith("image/") && (item.previewUrl || item.result?.url);

              return (
                <div key={item.id} className="glass min-w-[150px] max-w-[180px] flex-1 rounded-2xl p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>
                      <span className="rounded-lg p-1.5" style={{ background: "var(--primary-soft)", color: "var(--primary-light)" }}>{icon}</span>
                      <div className="min-w-0">
                        <span className="block truncate max-w-[100px]">{item.file.name || "Attachment"}</span>
                        {item.file.type?.startsWith("image/") && <span className={`block text-[10px] font-normal ${!item.hd && item.compressed && !item.compressionSkipped ? "text-[var(--success-text)]" : "text-[var(--text-secondary)]"}`}>{getImageSizeLabel(item)}</span>}
                      </div>
                    </div>
                    <button type="button" onClick={() => removeAttachment(item.id)} className="icon-btn" aria-label="Remove attachment">
                      <X size={14} />
                    </button>
                  </div>

                  {hasPreview ? (
                    <div className="relative">
                      <LazyImage src={item.previewUrl || item.result?.url} alt={item.file.name || "Attachment preview"} width={160} height={90} className="h-20 w-full rounded-xl" />
                      {item.status === "compressing" && <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30"><Loader2 size={16} className="animate-spin text-white" aria-label="Compressing image" /></div>}
                    </div>
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center rounded-xl text-[var(--text-muted)]" style={{ background: "var(--primary-soft)" }}>
                      {icon}
                    </div>
                  )}

                  {!item.file.type?.startsWith("image/") && <div className="mt-2 text-[10px] text-[var(--text-secondary)]">{formatBytes(item.file.size)}</div>}

                  {isHdCapableImage(item.file) && (
                    <button type="button" onClick={() => setAttachmentHd(item.id, !item.hd)} aria-pressed={item.hd} title="Send original quality (uses more storage)" className={`mt-2 rounded-md border px-2 py-1 text-[10px] font-bold ${item.hd ? "border-[var(--primary-border)] bg-[var(--primary)] text-[var(--on-primary)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}>HD</button>
                  )}

                  {item.status === "uploading" && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="relative h-8 w-8 rounded-full" style={{ background: `conic-gradient(var(--primary) ${item.progress || 0}%, rgba(255,255,255,0.08) 0)` }}>
                        <div className="absolute inset-[3px] rounded-full" style={{ background: "var(--surface-3)" }} />
                        <span className="absolute inset-0 flex items-center justify-center text-[9px]">{item.progress || 0}%</span>
                      </div>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${item.progress || 0}%` }} />
                      </div>
                    </div>
                  )}

                  {item.status === "error" && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-[10px] text-[var(--danger-text)]"><AlertTriangle size={12} />{item.error || "Upload failed"}</div>
                      {item.retryable && <button type="button" onClick={() => startAttachmentUpload(item)} className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-2 py-1 text-[10px] font-semibold text-[var(--on-primary)]"><RefreshCw size={11} />Retry</button>}
                    </div>
                  )}

                  {item.status === "done" && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-[var(--success-text)]"><CheckCircle2 size={12} />Uploaded</div>
                  )}

                  {item.status === "blocked" && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-[var(--warning-text)]"><AlertTriangle size={12} />{item.error}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {forwardingMessage && (
          <motion.div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-[var(--overlay)] p-4"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0 }}
            role="presentation"
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close forward voice message"
              onClick={() => !forwardingBusy && setForwardingMessage(null)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="forward-voice-title"
              aria-describedby="forward-voice-description"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              className="glass relative z-[1] flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--border)] p-4 shadow-xl"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="forward-voice-title" className="text-base font-semibold text-[var(--text-primary)]">Forward voice message</h2>
                <button
                  type="button"
                  className="icon-btn min-h-11 min-w-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  aria-label="Close forward voice message"
                  disabled={forwardingBusy}
                  onClick={() => setForwardingMessage(null)}
                >
                  <X size={18} />
                </button>
              </div>
              <p id="forward-voice-description" className="mb-3 text-sm text-[var(--text-secondary)]">Choose a chat to send this voice message to.</p>
              <div className="media-card mb-4 rounded-2xl border px-3 py-2.5">
                <VoiceMessage
                  message={forwardingMessage}
                  isOwn={forwardingMessage.senderId === currentUser?.uid}
                />
              </div>
              {forwardError && <p className="mb-3 text-sm text-[var(--danger-text)]" role="alert">{forwardError}</p>}
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Available chats">
                {forwardTargets.map(([targetChatId, chat]) => {
                  const targetUser = chat.userInfo;
                  const title = targetUser.displayName || targetUser.name || "Conversation";
                  const isGroup = Boolean(targetUser.isGroup);
                  return (
                    <button
                      key={targetChatId}
                      type="button"
                      className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[var(--text-primary)] transition-colors hover:bg-[var(--hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-wait disabled:opacity-60"
                      disabled={forwardingBusy}
                      aria-label={`Forward voice message to ${title}`}
                      onClick={() => forwardVoiceMessage(targetChatId, targetUser)}
                    >
                      {forwardingChatId === targetChatId && forwardingBusy
                        ? <Loader2 size={17} className={shouldReduceMotion ? "" : "animate-spin"} aria-hidden="true" />
                        : <Forward size={17} className="text-[var(--primary)]" aria-hidden="true" />}
                      <span className="min-w-0 flex-1 truncate">{title}</span>
                      <span className="text-xs text-[var(--text-muted)]">{isGroup ? "Group" : "Chat"}</span>
                    </button>
                  );
                })}
                {forwardTargets.length === 0 && (
                  <p className="px-3 py-5 text-center text-sm text-[var(--text-secondary)]">No chats are available to forward to.</p>
                )}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:opacity-60"
                  disabled={forwardingBusy}
                  onClick={() => setForwardingMessage(null)}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isDragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center border-2 border-dashed border-[var(--primary-border)] bg-[var(--primary-soft)]">
          <div className="glass rounded-2xl px-6 py-4 text-sm font-semibold text-[var(--text-primary)] shadow-lg">Drop files to attach</div>
        </div>
      )}
    </div>
  );
};

export default Input;
