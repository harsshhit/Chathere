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
      const storage = getStorage();
      const imageRef = storageRef(storage, message.img);
      const url = await getDownloadURL(imageRef);

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
    <motion.div
      ref={ref}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex ${
        message.senderId === currentUser.uid ? "flex-row-reverse" : "flex-row"
      } gap-4 items-end mb-6`}
    >
      <motion.div 
        whileHover={{ scale: 1.1 }}
        className="flex flex-col gap-1"
      >
        <img
          src={
            message.senderId === currentUser.uid
              ? currentUser.photoURL
              : data.user.photoURL
          }
          alt="avatar"
          className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-lg"
        />
      </motion.div>

      <div
        className={`flex flex-col gap-2 max-w-[80%] ${
          message.senderId === currentUser.uid ? "items-end" : "items-start"
        }`}
      >
        <div className="flex flex-col gap-1">
          {message.text && (
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="relative"
            >
              <p
                className={`py-2 px-4 pb-5 rounded-2xl backdrop-blur-sm
                  ${
                    message.senderId === currentUser.uid
                      ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-br-none"
                      : "bg-gradient-to-br from-gray-50 to-white text-gray-800 rounded-bl-none"
                  } 
                  shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300
                  border border-white/20`}
              >
                {message.text}
                <span
                  className={`absolute bottom-1 ${
                    message.senderId === currentUser.uid ? "right-2" : "left-2"
                  } text-[10px] ${message.senderId === currentUser.uid ? "text-blue-100" : "text-gray-400"}`}
                >
                  {formatDate(message.date)}
                </span>
              </p>
            </motion.div>
          )}
        </div>

        {message.img && (
          <motion.div
            layout
            className={`relative ${isExpanded ? "w-full" : "w-auto"}`}
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
                rounded-xl cursor-pointer
                transition-all duration-300
                ${
                  isExpanded
                    ? "w-full h-[60vh] object-contain"
                    : "max-h-[40vh] object-cover w-auto"
                }
                shadow-[0_8px_30px_rgb(0,0,0,0.12)]
                hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]
                border-2 border-white/50
                ${
                  message.senderId === currentUser.uid
                    ? "hover:brightness-95"
                    : "hover:brightness-90"
                }
              `}
              layoutId={`message-image-${message.id}`}
              whileHover={{ scale: 1.02 }}
            />
            <span
              className={`absolute bottom-2 ${
                message.senderId === currentUser.uid ? "right-2" : "left-2"
              } text-[10px] text-white bg-black/50 backdrop-blur-md px-2 py-1 rounded-full`}
            >
              {formatDate(message.date)}
            </span>
            {isExpanded && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                onClick={handleDownload}
                disabled={isDownloading}
                className={`
                  absolute bottom-4 left-4 p-3
                  ${
                    isDownloading
                      ? "bg-gray-400/80"
                      : "bg-gradient-to-r from-white/80 to-gray-100/80 hover:from-white/90 hover:to-gray-100/90"
                  }
                  backdrop-blur-md
                  text-gray-800 rounded-full
                  shadow-[0_8px_30px_rgb(0,0,0,0.12)]
                  border border-white/50
                  transition-all duration-300 
                  hover:scale-110 hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)]
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                  group
                `}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
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
    </motion.div>
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
