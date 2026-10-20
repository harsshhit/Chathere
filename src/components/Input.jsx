import React, { useContext, useState, useRef, useEffect, useReducer, useCallback } from "react";
import {
  Send,
  Smile,
  X,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  FileText,
  Video,
  Music4,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import {
  arrayUnion,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  increment,
  runTransaction,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { v4 as uuid } from "uuid";
import EmojiPicker from "emoji-picker-react";
import { motion, AnimatePresence } from "framer-motion";
import GifPicker from "./GifPicker";
import { useTheme } from "../context/ThemeContext";
import { pendingMessagesStore } from "../utils/pendingMessages";
import { uploadImage, uploadFile } from "../utils/cloudinary";
import {
  MAX_IMAGE_MB,
  MAX_VIDEO_MB,
  MAX_FILE_MB,
  MAX_AUDIO_MB,
  MAX_FILES_PER_MESSAGE,
  BLOCKED_EXTENSIONS,
} from "../config/uploadLimits";

const formatBytes = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  const rounded = size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
};

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

const getBlockedStatus = (file) => {
  const name = file?.name || "";
  const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  if (extension && BLOCKED_EXTENSIONS.includes(extension)) {
    return { status: "blocked", message: `Blocked file type: .${extension}` };
  }
  const kind = getAttachmentKind(file);
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
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState("");
  const [attachmentQueue, dispatchAttachments] = useReducer(attachmentReducer, []);
  const [isDragOver, setIsDragOver] = useState(false);

  const { currentUser } = useContext(AuthContext);
  const { data, replyingTo, setReplyingTo, editingMessage, setEditingMessage } = useContext(ChatContext);
  const { theme } = useTheme();
  const pickerRef = useRef(null);
  const inputRef = useRef(null);
  const queueInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const imageInputRef = useRef(null);
  const draftsRef = useRef({});

  useEffect(() => () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
  }, [imagePreviewUrl]);

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
        type: ["text", "gif", "image"].includes(replyingTo.type) ? replyingTo.type : "text",
      },
    };
  };

  const stopTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (data.chatId) {
      updateDoc(doc(db, "chats", data.chatId), {
        [`typing.${currentUser.uid}`]: false
      }).catch(() => { });
    }
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

  const handleFilesAdded = useCallback((incomingFiles) => {
    const files = Array.from(incomingFiles || []).filter(Boolean);
    if (!files.length) return;

    const currentCount = attachmentQueue.length;
    const remainingSlots = Math.max(0, MAX_FILES_PER_MESSAGE - currentCount);
    const usableFiles = files.slice(0, remainingSlots);
    if (!usableFiles.length) return;

    const nextItems = usableFiles.map((file) => {
      const validation = getBlockedStatus(file);
      const previewUrl = file.type?.startsWith("image/") ? URL.createObjectURL(file) : "";
      return {
        id: uuid(),
        file,
        previewUrl,
        status: validation.status,
        progress: 0,
        error: validation.status === "error" ? validation.message : validation.status === "blocked" ? validation.message : "",
        retryable: false,
        result: null,
      };
    });

    dispatchAttachments({ type: "add", items: nextItems });
  }, [attachmentQueue.length]);

  const removeAttachment = (id) => {
    const item = attachmentQueue.find((entry) => entry.id === id);
    if (item?.controller) item.controller.abort();
    dispatchAttachments({ type: "remove", id });
  };

  const startAttachmentUpload = async (item) => {
    if (!item || item.status === "blocked" || (item.status === "error" && !item.retryable)) return;
    const controller = new AbortController();
    dispatchAttachments({
      type: "update",
      id: item.id,
      changes: { status: "uploading", progress: 0, error: "", controller },
    });

    try {
      const result = await uploadFile(item.file, {
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

  const ensureChatDocAndUserChats = async (lastMsgText) => {
    if (!data.chatId) return;

    const chatRef = doc(db, "chats", data.chatId);
    const chatSnap = await getDoc(chatRef);
    if (!chatSnap.exists()) {
      await setDoc(chatRef, { messages: [], typing: {}, lastRead: {} }, { merge: true });
    }

    if (data.user?.isGroup && data.user?.members) {
      for (const member of data.user.members) {
        await updateDoc(doc(db, "userChats", member.uid), {
          [`${data.chatId}.userInfo`]: data.user,
          [`${data.chatId}.lastMessage`]: { text: lastMsgText, senderId: currentUser.uid, date: Date.now() },
          [`${data.chatId}.date`]: serverTimestamp(),
          [`${data.chatId}.unread`]: member.uid === currentUser.uid ? 0 : increment(1),
        }).catch(async () => {
          await setDoc(doc(db, "userChats", member.uid), {
            [data.chatId]: {
              userInfo: data.user,
              lastMessage: { text: lastMsgText, senderId: currentUser.uid, date: Date.now() },
              date: serverTimestamp(),
              unread: member.uid === currentUser.uid ? 0 : 1,
            }
          }, { merge: true });
        });
      }
    } else if (data.user?.uid) {
      await updateDoc(doc(db, "userChats", currentUser.uid), {
        [`${data.chatId}.userInfo`]: {
          uid: data.user.uid,
          displayName: data.user.displayName,
          photoURL: data.user.photoURL,
        },
        [`${data.chatId}.lastMessage`]: { text: lastMsgText, senderId: currentUser.uid, date: Date.now() },
        [`${data.chatId}.date`]: serverTimestamp(),
      }).catch(async () => {
        await setDoc(doc(db, "userChats", currentUser.uid), {
          [data.chatId]: {
            userInfo: {
              uid: data.user.uid,
              displayName: data.user.displayName,
              photoURL: data.user.photoURL,
            },
            lastMessage: { text: lastMsgText, senderId: currentUser.uid, date: Date.now() },
            date: serverTimestamp(),
          }
        }, { merge: true });
      });

      await updateDoc(doc(db, "userChats", data.user.uid), {
        [`${data.chatId}.userInfo`]: {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
        },
        [`${data.chatId}.lastMessage`]: { text: lastMsgText, senderId: currentUser.uid, date: Date.now() },
        [`${data.chatId}.date`]: serverTimestamp(),
        [`${data.chatId}.unread`]: increment(1),
      }).catch(async () => {
        await setDoc(doc(db, "userChats", data.user.uid), {
          [data.chatId]: {
            userInfo: {
              uid: currentUser.uid,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
            },
            lastMessage: { text: lastMsgText, senderId: currentUser.uid, date: Date.now() },
            date: serverTimestamp(),
            unread: 1,
          }
        }, { merge: true });
      });
    }
  };

  const notifyRecipients = async (recipientUids, body) => {
    if (recipientUids.length === 0) {
      console.warn("notify skipped: no recipients");
      return;
    }

    try {
      const firebaseUser = auth.currentUser;
      const idToken = await firebaseUser.getIdToken();
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + idToken,
        },
        body: JSON.stringify({
          chatId: data.chatId,
          recipientUids,
          title: currentUser.displayName || "New message",
          body,
        }),
      });

      if (!response.ok) {
        console.warn("notify failed", response.status, await response.text());
        return;
      }

      console.info("notify ok", await response.json());
    } catch (error) {
      console.warn("notify error", error);
    }
  };

  const handleSend = async () => {
    const msgText = text.trim();
    if (!data.chatId) return;

    if (attachmentQueue.length > 0) {
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
          return {
            id: uuid(),
            text: caption || defaultText,
            img: result.url || file.name,
            senderId: currentUser.uid,
            senderName: currentUser.displayName,
            senderPhoto: currentUser.photoURL,
            date: Timestamp.fromDate(new Date()),
            type: "image",
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
        const chatRef = doc(db, "chats", data.chatId);
        try {
          await updateDoc(chatRef, {
            messages: arrayUnion(...basePayloads),
          });
        } catch (updateErr) {
          await setDoc(chatRef, {
            messages: basePayloads,
            typing: {},
            lastRead: {},
          }, { merge: true });
        }

        const messageBody = basePayloads[0]?.text || "📎 File";
        await ensureChatDocAndUserChats(messageBody);
        const recipientUids = data.user?.isGroup
          ? (data.user.members || []).map((member) => member.uid).filter((uid) => uid && uid !== currentUser.uid)
          : data.user?.uid
          ? [data.user.uid]
          : [];
        void notifyRecipients(recipientUids, messageBody);
      } catch (error) {
        console.error("Error sending attachment message:", error);
        return;
      }

      setText("");
      setReplyingTo(null);
      setEditingMessage(null);
      clearDraft();
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
                [`${data.chatId}.lastMessage.text`]: msgText,
              });
            }
          }
        });
      } catch (error) {
        console.error("Error editing message:", error);
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

    (async () => {
      try {
        const chatRef = doc(db, "chats", data.chatId);
        const payload = {
          id: msgId,
          text: msgText,
          senderId: currentUser.uid,
          senderName: currentUser.displayName,
          senderPhoto: currentUser.photoURL,
          date: Timestamp.fromDate(optimisticDate),
          ...getReplyPayload(),
        };

        try {
          await updateDoc(chatRef, {
            messages: arrayUnion(payload),
          });
        } catch (updateErr) {
          await setDoc(chatRef, {
            messages: [payload],
            typing: {},
            lastRead: {},
          }, { merge: true });
        }

        await ensureChatDocAndUserChats(msgText);

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

  const handleGifSend = (gifUrl) => {
    setShowGifPicker(false);
    const msgText = text.trim();
    setText("");
    setReplyingTo(null);
    stopTyping();
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.focus());

    if (!data.chatId) return;

    const msgId = uuid();
    const optimisticDate = new Date();

    const optimisticMsg = {
      id: msgId,
      text: msgText,
      img: gifUrl,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      senderPhoto: currentUser.photoURL,
      date: optimisticDate,
      status: "sending",
      ...getReplyPayload(),
    };

    pendingMessagesStore.addMessage(data.chatId, optimisticMsg);

    (async () => {
      try {
        const chatRef = doc(db, "chats", data.chatId);
        const payload = {
          id: msgId,
          text: msgText,
          senderId: currentUser.uid,
          senderName: currentUser.displayName,
          senderPhoto: currentUser.photoURL,
          date: Timestamp.fromDate(optimisticDate),
          img: gifUrl,
          ...getReplyPayload(),
        };

        try {
          await updateDoc(chatRef, {
            messages: arrayUnion(payload),
          });
        } catch (updateErr) {
          await setDoc(chatRef, {
            messages: [payload],
            typing: {},
            lastRead: {},
          }, { merge: true });
        }

        await ensureChatDocAndUserChats(msgText || "Sent a GIF");

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
  };

  const sendUploadedImage = async (imageUrl) => {
    if (!data.chatId) return;
    const msgText = "📷 Photo";
    const msgId = uuid();
    const optimisticDate = new Date();
    const optimisticMsg = {
      id: msgId,
      text: msgText,
      img: imageUrl,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      senderPhoto: currentUser.photoURL,
      date: optimisticDate,
      status: "sending",
      ...getReplyPayload(),
    };
    pendingMessagesStore.addMessage(data.chatId, optimisticMsg);
    setText("");
    setReplyingTo(null);
    stopTyping();

    try {
      const chatRef = doc(db, "chats", data.chatId);
      const payload = {
        id: msgId,
        text: msgText,
        img: imageUrl,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        senderPhoto: currentUser.photoURL,
        date: Timestamp.fromDate(optimisticDate),
        ...getReplyPayload(),
      };
      try {
        await updateDoc(chatRef, { messages: arrayUnion(payload) });
      } catch (updateErr) {
        await setDoc(chatRef, { messages: [payload], typing: {}, lastRead: {} }, { merge: true });
      }
      await ensureChatDocAndUserChats(msgText);
      const recipientUids = data.user?.isGroup
        ? (data.user.members || []).map((member) => member.uid).filter((uid) => uid && uid !== currentUser.uid)
        : data.user?.uid ? [data.user.uid] : [];
      void notifyRecipients(recipientUids, msgText);
    } catch (error) {
      console.error("Error sending image message:", error);
      pendingMessagesStore.updateMessageStatus(data.chatId, msgId, "failed");
    }
  };

  const uploadSelectedImage = async (file = selectedImage) => {
    if (!file || !data.chatId || uploadingImage) return;
    setUploadingImage(true);
    setUploadProgress(0);
    setImageUploadError("");
    try {
      const imageUrl = await uploadImage(file, {
        folder: "chathere/chat",
        onProgress: setUploadProgress,
      });
      await sendUploadedImage(imageUrl);
      setSelectedImage(null);
      setImagePreviewUrl("");
      setUploadProgress(0);
    } catch (error) {
      setImageUploadError(error.message || "Image upload failed. Please retry.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setImageUploadError("");
    void uploadSelectedImage(file);
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
      }).catch(() => {});
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
      updateDoc(doc(db, "chats", data.chatId), {
        [`typing.${currentUser.uid}`]: true
      }).catch(() => { });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 2000);
    }
  };

  const handleTyping = (e) => {
    const nextValue = e.target.value;
    persistDraft(nextValue);

    if (data.chatId) {
      updateDoc(doc(db, "chats", data.chatId), {
        [`typing.${currentUser.uid}`]: true
      }).catch(() => { });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 2000);
    }
  };

  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCanHover(window.matchMedia("(hover: hover)").matches);
    }
  }, []);

  return (
    <div
      className="px-3 py-3 sm:px-4 sm:py-3.5 safe-bottom"
      style={{
        background: "var(--surface-2)",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
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
            <div
              className="mb-2 flex items-center gap-2 rounded-xl px-3 py-2"
              style={{
                background: "var(--surface-3)",
                borderLeft: `3px solid ${editingMessage ? "rgba(99,102,241,0.9)" : "var(--primary-light)"}`,
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" style={{ color: "var(--primary-light)" }}>
                  {editingMessage ? "Editing message" : `Replying to ${replyingTo?.senderName || "User"}`}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                  {editingMessage
                    ? editingMessage.text || "Message"
                    : replyingTo?.type === "image"
                      ? "📷 Photo"
                      : replyingTo?.type === "gif"
                        ? "GIF"
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
                className="icon-btn flex-shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label={editingMessage ? "Cancel edit" : "Cancel reply"}
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {imagePreviewUrl && (
        <div className="mb-2 flex items-center gap-3 rounded-xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-3)" }}>
          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
            <img src={imagePreviewUrl} alt="Selected upload" className="h-full w-full object-cover" />
            {uploadingImage && <div className="absolute inset-x-0 bottom-0 h-1 bg-black/25"><div className="h-full bg-indigo-500 transition-all" style={{ width: `${uploadProgress}%` }} /></div>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>{uploadingImage ? `Uploading photo ${uploadProgress}%` : "Photo ready to retry"}</p>
            {imageUploadError && <p role="alert" className="truncate text-[11px] text-red-500">{imageUploadError}</p>}
          </div>
          {imageUploadError && <button type="button" onClick={() => uploadSelectedImage()} disabled={uploadingImage} className="text-xs font-semibold text-indigo-500 disabled:opacity-50">Retry</button>}
          <button type="button" onClick={() => { setSelectedImage(null); setImagePreviewUrl(""); setImageUploadError(""); }} disabled={uploadingImage} className="icon-btn" aria-label="Remove selected photo"><X size={15} /></button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
        <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage} className="icon-btn flex-shrink-0" aria-label="Send photo" title="Send photo" style={{ width: "42px", height: "42px", touchAction: "manipulation" }}>
          {uploadingImage ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
        </button>
        <motion.button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.preventDefault()}
          whileHover={canHover ? { scale: 1.05 } : undefined}
          whileTap={{ scale: 0.95 }}
          onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
          className="icon-btn flex-shrink-0 cursor-pointer font-bold tracking-widest text-[11px]"
          title="Send GIF"
          style={{
            width: "42px",
            height: "42px",
            color: showGifPicker ? "var(--primary-light)" : "var(--text-muted)",
            touchAction: "manipulation",
          }}
        >
          GIF
        </motion.button>

        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-colors duration-200"
            style={{ color: showEmojiPicker ? "var(--primary-light)" : "var(--text-muted)" }}
            aria-label="Emoji picker"
          >
            <Smile size={18} />
          </button>

          <AnimatePresence>
            {(showEmojiPicker || showGifPicker) && (
              <motion.div
                ref={pickerRef}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full left-0 mb-2 z-50"
                style={{ boxShadow: "0 20px 60px var(--shadow)" }}
              >
                {showEmojiPicker ? (
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    width={300}
                    height={380}
                    theme={theme === "dark" ? "dark" : "light"}
                    lazyLoadEmojis
                  />
                ) : (
                  <GifPicker onGifSelect={handleGifSend} />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <textarea
            ref={inputRef}
            rows={1}
            placeholder="Message…"
            value={text}
            onChange={handleTyping}
            onKeyDown={handleKeyDown}
            onPaste={handleTextareaPaste}
            className="chat-input !pl-11 w-full resize-none"
            id="chat-message-input"
            aria-label="Message input"
            style={{
              minHeight: "44px",
              maxHeight: "160px",
              overflowY: text && inputRef.current && inputRef.current.scrollHeight > 160 ? "auto" : "hidden",
            }}
          />
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

        <button
          type="button"
          onClick={() => queueInputRef.current?.click()}
          className="icon-btn flex-shrink-0"
          aria-label="Attach files"
          title="Attach files"
          style={{ width: "42px", height: "42px", touchAction: "manipulation" }}
        >
          <Paperclip size={18} />
        </button>

        <AnimatePresence initial={false} mode="wait">
          {!text.trim() && attachmentQueue.length === 0 ? (
            <motion.button
              key="mic"
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              disabled
              className="send-btn flex-shrink-0 opacity-70"
              id="chat-mic-btn"
              aria-label="Voice messages coming soon"
              title="Voice messages coming soon"
              style={{ touchAction: "manipulation" }}
            >
              <Mic size={18} className="ml-0.5" />
            </motion.button>
          ) : (
            <motion.button
              key="send"
              type="button"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              whileHover={canHover ? { scale: 1.05 } : undefined}
              whileTap={{ scale: 0.95 }}
              onClick={handleSend}
              disabled={uploadingImage || attachmentQueue.some((item) => item.status === "uploading")}
              className="send-btn flex-shrink-0"
              id="chat-send-btn"
              aria-label="Send message"
              style={{ touchAction: "manipulation" }}
            >
              <Send size={18} className="ml-0.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {attachmentQueue.length > 0 && (
        <div className="mt-3 space-y-2">
          {attachmentQueue.length === 1 && attachmentQueue[0]?.file?.type?.startsWith("image/") && attachmentQueue[0].status !== "blocked" && (
            <div className="rounded-2xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-3)" }}>
              <img src={attachmentQueue[0].previewUrl || attachmentQueue[0].result?.url} alt="Attachment preview" className="h-36 w-full rounded-xl object-cover" />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button type="button" onClick={() => removeAttachment(attachmentQueue[0].id)} className="text-xs font-semibold text-red-400">Remove</button>
                <button type="button" onClick={handleSend} disabled={attachmentQueue[0].status === "uploading"} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Send</button>
              </div>
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
                <div key={item.id} className="min-w-[150px] max-w-[180px] flex-1 rounded-2xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface-3)" }}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-medium" style={{ color: "var(--text-primary)" }}>
                      <span className="rounded-lg p-1.5" style={{ background: "rgba(99,102,241,0.12)", color: "var(--primary-light)" }}>{icon}</span>
                      <span className="truncate max-w-[100px]">{item.file.name || "Attachment"}</span>
                    </div>
                    <button type="button" onClick={() => removeAttachment(item.id)} className="icon-btn" aria-label="Remove attachment">
                      <X size={14} />
                    </button>
                  </div>

                  {hasPreview ? (
                    <img src={item.previewUrl || item.result?.url} alt={item.file.name || "Attachment preview"} className="h-20 w-full rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-20 w-full items-center justify-center rounded-xl text-[var(--text-muted)]" style={{ background: "rgba(99,102,241,0.08)" }}>
                      {icon}
                    </div>
                  )}

                  <div className="mt-2 text-[10px] text-[var(--text-secondary)]">{formatBytes(item.file.size)}</div>

                  {item.status === "uploading" && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="relative h-8 w-8 rounded-full" style={{ background: `conic-gradient(var(--primary) ${item.progress || 0}%, rgba(255,255,255,0.08) 0)` }}>
                        <div className="absolute inset-[3px] rounded-full" style={{ background: "var(--surface-3)" }} />
                        <span className="absolute inset-0 flex items-center justify-center text-[9px]">{item.progress || 0}%</span>
                      </div>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${item.progress || 0}%` }} />
                      </div>
                    </div>
                  )}

                  {item.status === "error" && (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 text-[10px] text-red-400"><AlertTriangle size={12} />{item.error || "Upload failed"}</div>
                      {item.retryable && <button type="button" onClick={() => startAttachmentUpload(item)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white"><RefreshCw size={11} />Retry</button>}
                    </div>
                  )}

                  {item.status === "done" && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 size={12} />Uploaded</div>
                  )}

                  {item.status === "blocked" && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-400"><AlertTriangle size={12} />{item.error}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isDragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center border-2 border-dashed border-indigo-400 bg-indigo-500/10" style={{ backdropFilter: "blur(2px)" }}>
          <div className="rounded-2xl border border-indigo-400/60 bg-[var(--surface)] px-6 py-4 text-sm font-semibold text-[var(--text-primary)] shadow-lg">Drop files to attach</div>
        </div>
      )}
    </div>
  );
};

export default Input;
