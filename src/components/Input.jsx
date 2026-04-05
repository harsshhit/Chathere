import React, { useContext, useState, useRef, useEffect } from "react";
import { Image, Send, X, Loader2, Smile } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import {
  arrayUnion,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db, storage } from "../firebase";
import { v4 as uuid } from "uuid";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import EmojiPicker from "emoji-picker-react";
import { motion, AnimatePresence } from "framer-motion";
import GifPicker from "./GifPicker";

const Input = () => {
  const [text, setText] = useState("");
  const [img, setImg] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);

  const { currentUser } = useContext(AuthContext);
  const { data } = useContext(ChatContext);
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const pickerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const stopTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (data.chatId) {
      updateDoc(doc(db, "chats", data.chatId), {
        [`typing.${currentUser.uid}`]: false
      }).catch(() => {}); // ignore errors if doc doesn't exist yet
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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        alert("File size should not exceed 5MB");
        return;
      }
      setImg(file);
      setImgPreview(URL.createObjectURL(file));
    }
  };

  const handleCancelImage = () => {
    setImg(null);
    setImgPreview(null);
  };

  const updateUserChats = async (lastMsgText) => {
    const promises = [];
    if (data.user?.isGroup && data.user?.members) {
      data.user.members.forEach((member) => {
        promises.push(
          updateDoc(doc(db, "userChats", member.uid), {
            [data.chatId + ".lastMessage"]: { text: lastMsgText, senderId: currentUser.uid },
            [data.chatId + ".date"]: serverTimestamp(),
          })
        );
      });
    } else {
      promises.push(
        updateDoc(doc(db, "userChats", currentUser.uid), {
          [data.chatId + ".lastMessage"]: { text: lastMsgText, senderId: currentUser.uid },
          [data.chatId + ".date"]: serverTimestamp(),
        })
      );
      promises.push(
        updateDoc(doc(db, "userChats", data.user.uid), {
          [data.chatId + ".lastMessage"]: { text: lastMsgText, senderId: currentUser.uid },
          [data.chatId + ".date"]: serverTimestamp(),
        })
      );
    }
    return Promise.all(promises);
  };

  const handleSend = async () => {
    if (!text.trim() && !img) return;
    setIsLoading(true);
    stopTyping();

    try {
      if (img) {
        const storageRef = ref(storage, uuid());
        const uploadTask = uploadBytesResumable(storageRef, img);

        uploadTask.on("state_changed", null, (error) => {
          console.error("Upload error:", error);
          setIsLoading(false);
        }, async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            await updateDoc(doc(db, "chats", data.chatId), {
              messages: arrayUnion({
                id: uuid(),
                text,
                senderId: currentUser.uid,
                senderName: currentUser.displayName,
                senderPhoto: currentUser.photoURL,
                date: Timestamp.now(),
                img: downloadURL,
              }),
            });
            await updateUserChats(text || "Sent an image");
            setText("");
            setImg(null);
            setImgPreview(null);
          } catch (err) {
            console.error(err);
          } finally {
            setIsLoading(false);
          }
        });
      } else {
        await updateDoc(doc(db, "chats", data.chatId), {
          messages: arrayUnion({
            id: uuid(),
            text,
            senderId: currentUser.uid,
            senderName: currentUser.displayName,
            senderPhoto: currentUser.photoURL,
            date: Timestamp.now(),
          }),
        });
        await updateUserChats(text);
        setText("");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error sending:", error);
      setIsLoading(false);
    }
  };

  const handleGifSend = async (gifUrl) => {
    setShowGifPicker(false);
    setIsLoading(true);
    stopTyping();

    try {
      await updateDoc(doc(db, "chats", data.chatId), {
        messages: arrayUnion({
          id: uuid(),
          text,
          senderId: currentUser.uid,
          senderName: currentUser.displayName,
          senderPhoto: currentUser.photoURL,
          date: Timestamp.now(),
          img: gifUrl,
        }),
      });
      await updateUserChats(text || "Sent a GIF");
      setText("");
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onEmojiClick = (emojiObject) => {
    setText((prev) => prev + emojiObject.emoji);
    inputRef.current?.focus();
    
    if (data.chatId && !isLoading) {
      updateDoc(doc(db, "chats", data.chatId), {
        [`typing.${currentUser.uid}`]: true
      }).catch(() => {});
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 2000);
    }
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    
    if (data.chatId && !isLoading) {
      updateDoc(doc(db, "chats", data.chatId), {
        [`typing.${currentUser.uid}`]: true
      }).catch(() => {});
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 2000);
    }
  };

  return (
    <div
      className="px-3 py-3 sm:px-4 sm:py-3.5"
      style={{ background: "var(--surface-2)" }}
    >
      {/* Image preview */}
      <AnimatePresence>
        {imgPreview && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="mb-3 relative inline-flex"
          >
            <img
              src={imgPreview}
              alt="Preview"
              className="max-h-24 rounded-xl object-cover"
              style={{ border: "1px solid var(--border-light)", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
            />
            <button
              onClick={handleCancelImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center transition-colors duration-200"
              style={{ background: "#ef4444", color: "white", boxShadow: "0 2px 8px rgba(239,68,68,0.4)" }}
            >
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="flex items-center gap-2">
        {/* Image upload */}
        <div className="flex-shrink-0">
          <input
            type="file"
            id="chat-file"
            className="hidden"
            onChange={handleImageChange}
            accept="image/*"
            disabled={isLoading}
          />
          <motion.label
            htmlFor="chat-file"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="icon-btn cursor-pointer flex-shrink-0"
            title="Attach image"
          >
            <Image size={20} />
          </motion.label>
        </div>

        {/* Text input + emoji */}
        <div className="relative flex-1">
          {/* Emoji toggle */}
          <button
            type="button"
            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-colors duration-200"
            style={{ color: showEmojiPicker ? "var(--primary-light)" : "var(--text-muted)" }}
          >
            <Smile size={18} />
          </button>

          {/* Emoji & GIF pickers */}
          <AnimatePresence>
            {(showEmojiPicker || showGifPicker) && (
              <motion.div
                ref={pickerRef}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute bottom-full left-0 mb-2 z-50"
                style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
              >
                {showEmojiPicker ? (
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    width={300}
                    height={380}
                    theme="dark"
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
            disabled={isLoading}
            className="chat-input !pl-11"
            id="chat-message-input"
          />
        </div>

        {/* GIF toggle */}
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
          className="icon-btn flex-shrink-0 cursor-pointer font-bold tracking-widest text-[11px]"
          title="Send GIF"
          style={{ width: "42px", height: "42px", color: showGifPicker ? "var(--primary-light)" : "var(--text-muted)" }}
        >
          GIF
        </motion.button>

        {/* Send button */}
        <motion.button
          whileHover={(!text.trim() && !img) || isLoading ? {} : { scale: 1.05 }}
          whileTap={(!text.trim() && !img) || isLoading ? {} : { scale: 0.95 }}
          onClick={handleSend}
          disabled={(!text.trim() && !img) || isLoading}
          className="send-btn flex-shrink-0"
          id="chat-send-btn"
        >
          {isLoading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Send size={18} className="ml-0.5" />
          )}
        </motion.button>
      </div>
    </div>
  );
};

export default Input;
