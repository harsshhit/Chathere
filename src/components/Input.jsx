import React, { useContext, useState, useRef, useEffect } from "react";
import { Send, Smile } from "lucide-react";
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
} from "firebase/firestore";
import { db } from "../firebase";
import { v4 as uuid } from "uuid";
import EmojiPicker from "emoji-picker-react";
import { motion, AnimatePresence } from "framer-motion";
import GifPicker from "./GifPicker";
import { useTheme } from "../context/ThemeContext";
import { pendingMessagesStore } from "../utils/pendingMessages";

const Input = () => {
  const [text, setText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);

  const { currentUser } = useContext(AuthContext);
  const { data } = useContext(ChatContext);
  const { theme } = useTheme();
  const pickerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const stopTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (data.chatId) {
      updateDoc(doc(db, "chats", data.chatId), {
        [`typing.${currentUser.uid}`]: false
      }).catch(() => { });
    }
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

  const handleSend = () => {
    const msgText = text.trim();
    if (!msgText || !data.chatId) return;

    // Immediately clear input and reset typing
    setText("");
    stopTyping();
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.focus());

    const msgId = uuid();
    const optimisticDate = new Date();

    // Optimistic pending message with clock icon
    const optimisticMsg = {
      id: msgId,
      text: msgText,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      senderPhoto: currentUser.photoURL,
      date: optimisticDate,
      status: "sending",
    };

    pendingMessagesStore.addMessage(data.chatId, optimisticMsg);

    // Send in background without freezing input bar
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
      } catch (err) {
        console.error("Error sending GIF:", err);
        pendingMessagesStore.updateMessageStatus(data.chatId, msgId, "failed");
      }
    })();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      inputRef.current?.focus();
    }
  };

  const onEmojiClick = (emojiObject) => {
    setText((prev) => prev + emojiObject.emoji);
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
    setText(e.target.value);

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
      <div className="flex items-center gap-2">
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

          <input
            ref={inputRef}
            type="text"
            placeholder="Message…"
            value={text}
            onChange={handleTyping}
            onKeyDown={handleKeyDown}
            className="chat-input !pl-11 w-full"
            id="chat-message-input"
          />
        </div>

        <motion.button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => e.preventDefault()}
          whileHover={canHover && text.trim() ? { scale: 1.05 } : undefined}
          whileTap={!text.trim() ? {} : { scale: 0.95 }}
          onClick={handleSend}
          disabled={!text.trim()}
          className="send-btn flex-shrink-0"
          id="chat-send-btn"
          aria-label="Send message"
          style={{ touchAction: "manipulation" }}
        >
          <Send size={18} className="ml-0.5" />
        </motion.button>
      </div>
    </div>
  );
};

export default Input;
