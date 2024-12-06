import React, { useContext, useState } from "react";
import { Image, Send, X, Loader2 } from "lucide-react"; // Using Lucide icons instead of images
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

const Input = () => {
  const [text, setText] = useState("");
  const [img, setImg] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const { currentUser } = useContext(AuthContext);
  const { data } = useContext(ChatContext);

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

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

              // Update userChats and reset state
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

  return (
    <div className="flex flex-col bg-blue-50 p-2 sm:p-3 md:p-4 ">
      {imgPreview && (
        <div className="mb-1 sm:mb-3 md:mb-4 relative inline-block">
          <img
            src={imgPreview}
            alt="Preview"
            className="max-h-24 sm:max-h-32 md:max-h-40 rounded-xl  object-contain bg-white  sm:p-1.5 md:p-2 "
          />
          <div className="absolute top-2 right-2 sm:top-2.5 md:top-3 sm:right-2.5 md:right-3 flex gap-1 sm:gap-1.5 md:gap-2">
            <button
              onClick={handleCancelImage}
              className="p-1.5 sm:p-1.5 md:p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
              disabled={isLoading}
            >
              <X size={14} className="sm:w-4 md:w-[16px] sm:h-4 md:h-[16px]" />
            </button>
            {img && !text && (
              <button
                onClick={handleSend}
                className="p-1.5 sm:p-1.5 md:p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors shadow-md"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 size={14} className="sm:w-4 md:w-[16px] sm:h-4 md:h-[16px] animate-spin" />
                ) : (
                  <Send size={14} className="sm:w-4 md:w-[16px] sm:h-4 md:h-[16px]" />
                )}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center gap-1.5 sm:gap-2">
        <input
          type="text"
          placeholder="Type something..."
          className="flex-grow px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 text-blue-900 bg-white border-2 border-blue-200 rounded-full
            focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-blue-200 focus:border-blue-400
            placeholder-blue-400 text-base sm:text-lg font-medium
            transition-all duration-300 ease-in-out shadow-sm"
          onChange={(e) => setText(e.target.value)}
          onKeyPress={handleKeyPress}
          value={text}
          disabled={isLoading}
        />
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
            <label
              htmlFor="file"
              className={`p-1.5 sm:p-2 cursor-pointer hover:bg-blue-50 transition-all duration-300 rounded-full
                group active:bg-blue-100 inline-block ${
                  isLoading ? "opacity-50 cursor-not-allowed" : ""
                }`}
            >
              <Image
                className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-500 group-hover:text-blue-600 group-hover:scale-110 
                transition-all duration-300"
              />
            </label>
          </div>
          
          <button
            onClick={handleSend}
            disabled={(!text && !img) || isLoading}
            className={`p-2 sm:p-2.5 md:p-3 rounded-full transition-all duration-300 
              flex items-center justify-center group shadow-sm
              ${
                (!text && !img) || isLoading
                  ? "bg-blue-800 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
              } text-white`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 animate-spin" />
            ) : (
              <Send
                className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 group-hover:scale-110 group-hover:rotate-12 
                transition-all duration-300"
              />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Input;
