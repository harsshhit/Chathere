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
import { motion } from "framer-motion";

const Input = () => {
  const [text, setText] = useState("");
  const [img, setImg] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const { currentUser } = useContext(AuthContext);
  const { data } = useContext(ChatContext);

  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
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

  const handleSend = async () => {
    if (!text && !img) return;
    setIsLoading(true);

    try {
      if (img) {
        const storageRef = ref(storage, uuid());
        const uploadTask = uploadBytesResumable(storageRef, img);

        uploadTask.on(
          "state_changed",
          null,
          (error) => {
            console.error("Error uploading image:", error);
            setIsLoading(false);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              await updateDoc(doc(db, "chats", data.chatId), {
                messages: arrayUnion({
                  id: uuid(),
                  text,
                  senderId: currentUser.uid,
                  date: Timestamp.now(),
                  img: downloadURL,
                }),
              });

              await Promise.all([
                updateDoc(doc(db, "userChats", currentUser.uid), {
                  [data.chatId + ".lastMessage"]: {
                    text: text || "Sent an image",
                  },
                  [data.chatId + ".date"]: serverTimestamp(),
                }),
                updateDoc(doc(db, "userChats", data.user.uid), {
                  [data.chatId + ".lastMessage"]: {
                    text: text || "Sent an image",
                  },
                  [data.chatId + ".date"]: serverTimestamp(),
                }),
              ]);

              setText("");
              setImg(null);
              setImgPreview(null);
            } catch (error) {
              console.error("Error processing upload:", error);
            } finally {
              setIsLoading(false);
            }
          }
        );
      } else {
        await updateDoc(doc(db, "chats", data.chatId), {
          messages: arrayUnion({
            id: uuid(),
            text,
            senderId: currentUser.uid,
            date: Timestamp.now(),
          }),
        });

        await Promise.all([
          updateDoc(doc(db, "userChats", currentUser.uid), {
            [data.chatId + ".lastMessage"]: {
              text,
            },
            [data.chatId + ".date"]: serverTimestamp(),
          }),
          updateDoc(doc(db, "userChats", data.user.uid), {
            [data.chatId + ".lastMessage"]: {
              text,
            },
            [data.chatId + ".date"]: serverTimestamp(),
          }),
        ]);

        setText("");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  const onEmojiClick = (emojiObject) => {
    setText((prevText) => prevText + emojiObject.emoji);
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="flex flex-col bg-gradient-to-br from-blue-50 to-indigo-50 p-2 sm:p-3 md:p-4 relative"
    >
      {imgPreview && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-1 sm:mb-3 md:mb-4 relative inline-block"
        >
          <img
            src={imgPreview}
            alt="Preview"
            className="max-h-24 sm:max-h-32 md:max-h-40 rounded-xl object-contain bg-gradient-to-br from-white to-blue-50 sm:p-1.5 md:p-2 shadow-md transform hover:scale-[1.02] transition-all duration-300"
          />
          <div className="absolute top-2 right-2 sm:top-2.5 md:top-3 sm:right-2.5 md:right-3 flex gap-1 sm:gap-1.5 md:gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleCancelImage}
              className="p-1.5 sm:p-1.5 md:p-2 bg-gradient-to-br from-red-500 to-red-600 text-white rounded-full hover:from-red-600 hover:to-red-700 transition-all shadow-lg"
              disabled={isLoading}
            >
              <X size={14} className="sm:w-4 md:w-[16px] sm:h-4 md:h-[16px]" />
            </motion.button>
          </div>
        </motion.div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div>
          <input
            type="file"
            style={{ display: "none" }}
            id="file"
            onChange={handleImageChange}
            accept="image/*"
            disabled={isLoading}
          />
          <motion.label
            whileHover={{
              scale: 1.1,
              rotateX: 10,
              boxShadow: "0 10px 20px rgba(59, 130, 246, 0.2)",
            }}
            whileTap={{
              scale: 0.9,
              rotateX: 20,
            }}
            htmlFor="file"
            className={`p-1.5 sm:p-2 cursor-pointer bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600
              hover:from-blue-500 hover:via-blue-600 hover:to-blue-700
              transition-all duration-300 rounded-full shadow-lg
              group active:bg-blue-700 inline-block transform perspective-1000
              ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Image
              className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white group-hover:text-blue-100 group-hover:scale-110 
              transition-all duration-300 drop-shadow-lg"
            />
          </motion.label>
        </div>

        <div className="relative flex-grow flex items-center">
          <div className="absolute left-2 z-10">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1.5 hover:bg-blue-100/50 rounded-full transition-all"
              type="button"
            >
              <Smile className="w-5 h-5 text-blue-500 hover:text-blue-600" />
            </motion.button>

            {showEmojiPicker && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                ref={pickerRef}
                className="absolute bottom-full left-0 mb-2 z-50"
              >
                <div className="shadow-2xl rounded-lg backdrop-blur-sm">
                  <EmojiPicker
                    onEmojiClick={onEmojiClick}
                    width={300}
                    height={400}
                  />
                </div>
              </motion.div>
            )}
          </div>

          <motion.input
            whileFocus={{ scale: 1.01 }}
            type="text"
            placeholder="Type something..."
            className="w-full pl-12 pr-4 sm:pr-5 md:pr-6 py-1.5 sm:py-2 text-blue-900 bg-gradient-to-r from-white to-blue-50/30 border-2 border-blue-200/50 rounded-full
              focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-blue-200/50 focus:border-blue-400/50
              placeholder-blue-400 text-base sm:text-lg font-medium
              transition-all duration-300 ease-in-out shadow-md backdrop-blur-sm"
            onChange={(e) => setText(e.target.value)}
            onKeyPress={handleKeyPress}
            value={text}
            disabled={isLoading}
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.05, rotateX: 5 }}
          whileTap={{ scale: 0.95, rotateX: 10 }}
          onClick={handleSend}
          disabled={(!text && !img) || isLoading}
          className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-all duration-300 
            flex items-center justify-center group
            shadow-[0_8px_16px_rgba(0,0,0,0.1)]
            hover:shadow-[0_12px_20px_rgba(0,0,0,0.15)]
            active:shadow-[0_4px_12px_rgba(0,0,0,0.2)]
            ${
              (!text && !img) || isLoading
                ? "bg-gradient-to-br from-blue-700 via-blue-800 to-blue-900 cursor-not-allowed"
                : "bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 hover:from-blue-500 hover:via-blue-600 hover:to-blue-700 active:from-blue-600 active:via-blue-700 active:to-blue-800"
            } 
            text-white transform hover:translate-y-[-2px]
            before:absolute before:inset-0 before:rounded-full before:bg-white/20 before:opacity-0 hover:before:opacity-100 before:transition-opacity
            border border-blue-400/30 backdrop-blur-sm`}
          style={{
            perspective: "1000px",
            transformStyle: "preserve-3d",
          }}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 animate-spin drop-shadow-lg" />
          ) : (
            <Send
              className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 
              group-hover:scale-110 group-hover:rotate-12 
              transition-all duration-300
              drop-shadow-lg"
            />
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default Input;
