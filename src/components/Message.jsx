import React, { useContext, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import { Download } from "lucide-react";
import {
  getStorage,
  ref as storageRef,
  getDownloadURL,
} from "firebase/storage";

const Message = ({ message }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { currentUser } = useContext(AuthContext);
  const { data } = useContext(ChatContext);
  const ref = useRef();

  const handleImageClick = () => {
    setIsExpanded(!isExpanded);
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    setIsDownloading(true);

    try {
      // Get the image URL from Firebase Storage
      const storage = getStorage();
      const imageRef = storageRef(storage, message.img);
      const url = await getDownloadURL(imageRef);

      // Create a temporary anchor element
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `chat-image-${message.id || Date.now()}.jpg`
      );
      link.setAttribute("target", "_blank");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading image:", error);
      alert("Failed to download image. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      ref={ref}
      className={`flex ${
        message.senderId === currentUser.uid ? "flex-row-reverse" : "flex-row"
      } gap-4 items-end mb-6`}
    >
      <div className="flex flex-col gap-1">
        <img
          src={
            message.senderId === currentUser.uid
              ? currentUser.photoURL
              : data.user.photoURL
          }
          alt="avatar"
          className="w-8 h-8 rounded-full object-cover"
        />
        <span className="text-xs text-gray-500">
          {formatDate(message.date)}
        </span>
      </div>

      <div
        className={`flex flex-col gap-2 max-w-[80%] ${
          message.senderId === currentUser.uid ? "items-end" : "items-start"
        }`}
      >
        {message.text && (
          <p
            className={`py-2 px-4 rounded-2xl ${
              message.senderId === currentUser.uid
                ? "bg-blue-500 text-white rounded-br-none"
                : "bg-white text-gray-800 rounded-bl-none"
            } shadow-md`}
          >
            {message.text}
          </p>
        )}

        {message.img && (
          <motion.div
            layout
            className={`relative ${isExpanded ? "w-full" : "w-auto "}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: 1,
              width: isExpanded ? "100%" : "auto",
            }}
            transition={{ duration: 0.3 }}
          >
            <motion.img
              src={message.img}
              alt="message"
              onClick={handleImageClick}
              className={`
                rounded-lg cursor-pointer shadow-lg
                transition-all duration-300
                ${
                  isExpanded
                    ? "w-full h-[60vh] object-contain"
                    : " max-h-[40vh] object-cover max-+h-[30vh] w-auto"
                }
                hover:shadow-xl
                ${
                  message.senderId === currentUser.uid
                    ? "hover:brightness-95"
                    : "hover:brightness-90"
                }
              `}
              layoutId={`message-image-${message.id}`}
            />
            {isExpanded && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                onClick={handleDownload}
                disabled={isDownloading}
                className={`
                  absolute bottom-4 right-4 p-3
                  ${
                    isDownloading
                      ? "bg-gray-400/80"
                      : "bg-white/80 hover:bg-white/90"
                  }
                  backdrop-blur-md
                  text-gray-800 rounded-full
                  shadow-[0_8px_30px_rgb(0,0,0,0.12)]
                  border border-gray-200
                  transition-all duration-300 
                  hover:scale-110 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                  group
                `}
              >
                <Download
                  size={20}
                  className={`
                    ${isDownloading ? "animate-pulse" : "group-hover:scale-110"}
                    transition-transform duration-300
                    text-gray-800
                  `}
                />
              </motion.button>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

// Helper function to format date
const formatDate = (date) => {
  if (!date) return "";
  try {
    return date.toDate().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "";
  }
};

export default Message;
