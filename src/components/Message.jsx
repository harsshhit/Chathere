import React, { useContext, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import { Download, ZoomIn, Check, CheckCheck } from "lucide-react";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";
import Avatar from "./Avatar";

const formatDate = (date) => {
  if (!date) return "";
  try {
    return date.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

const Message = ({ message, lastRead }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { currentUser } = useContext(AuthContext);
  const { data } = useContext(ChatContext);
  const ref = useRef();

  const isOwn = message.senderId === currentUser.uid;

  let isRead = false;
  if (isOwn && lastRead) {
    const msgTime = message.date?.toMillis ? message.date.toMillis() : 0;
    if (data.user?.isGroup && data.user?.members) {
      isRead = data.user.members.some(
        (m) => m.uid !== currentUser.uid && lastRead[m.uid] >= msgTime
      );
    } else {
      isRead = lastRead[data.user?.uid] >= msgTime;
    }
  }

  const handleDownload = async (e) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      if (message.img.startsWith("http") && !message.img.includes("firebasestorage")) {
        const link = document.createElement("a");
        link.href = message.img;
        link.setAttribute("download", `chat-image-${message.id || Date.now()}.gif`);
        link.setAttribute("target", "_blank");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const storage = getStorage();
        const imageRef = storageRef(storage, message.img);
        const url = await getDownloadURL(imageRef);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `chat-image-${message.id || Date.now()}.jpg`);
        link.setAttribute("target", "_blank");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
      console.error("Error downloading image:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex items-end gap-2.5 mb-3 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <Avatar
        src={isOwn ? currentUser.photoURL : (message.senderPhoto || data.user.photoURL)}
        alt={isOwn ? currentUser.displayName : (message.senderName || data.user.displayName)}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-1"
        style={{ border: "1.5px solid rgba(99,102,241,0.3)" }}
      />

      {/* Content */}
      <div className={`flex flex-col gap-1.5 max-w-[72%] sm:max-w-[65%] ${isOwn ? "items-end" : "items-start"}`}>
        {/* Sender Name for Groups */}
        {!isOwn && data.user?.isGroup && (
          <span className="text-[10px] text-gray-400 font-medium pl-1">
            {message.senderName || "Unknown"}
          </span>
        )}
        {/* Text bubble */}
        {message.text && (
          <div
            className={`relative px-3.5 py-2.5 text-sm leading-relaxed ${
              isOwn ? "msg-bubble-sent" : "msg-bubble-received"
            }`}
            style={{ maxWidth: "100%", wordBreak: "break-word" }}
          >
            {message.text}
            <span
              className={`flex items-center gap-1 justify-end text-[10px] mt-1 ${
                isOwn ? "text-indigo-200/70" : "opacity-50"
              }`}
              style={{ color: isOwn ? "rgba(255,255,255,0.5)" : "var(--text-muted)" }}
            >
              {formatDate(message.date)}
              {isOwn && (
                isRead ? (
                  <CheckCheck size={14} className="text-blue-400 opacity-90" />
                ) : (
                  <Check size={14} className="opacity-60" />
                )
              )}
            </span>
          </div>
        )}

        {/* Image */}
        {message.img && (
          <motion.div
            className="relative cursor-pointer overflow-hidden rounded-2xl group"
            onClick={() => setIsExpanded(!isExpanded)}
            animate={{ width: isExpanded ? "100%" : "auto" }}
            transition={{ duration: 0.3 }}
          >
            <img
              src={message.img}
              alt="attachment"
              className={`rounded-2xl object-cover transition-all duration-300 ${
                isExpanded ? "max-h-[60vh] w-full object-contain" : "max-h-[200px] max-w-[260px]"
              }`}
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              }}
            />
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 rounded-2xl flex items-center justify-center">
              <ZoomIn
                size={22}
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              />
            </div>

            {/* Timestamp on image */}
            <span
              className="absolute bottom-2 right-2 text-[10px] text-white px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            >
              {formatDate(message.date)}
              {isOwn && (
                isRead ? (
                  <CheckCheck size={12} className="text-blue-300 opacity-90" />
                ) : (
                  <Check size={12} className="opacity-80" />
                )
              )}
            </span>

            {/* Download button (expanded) */}
            {isExpanded && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15 }}
                onClick={handleDownload}
                disabled={isDownloading}
                className="absolute bottom-3 left-3 p-2.5 rounded-xl transition-all duration-200 disabled:opacity-50"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "white",
                }}
              >
                <Download size={16} className={isDownloading ? "animate-pulse" : ""} />
              </motion.button>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default Message;
