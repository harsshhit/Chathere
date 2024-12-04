import React, { useContext, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";

const Message = ({ message }) => {
  const { currentUser } = useContext(AuthContext);
  const { data } = useContext(ChatContext);
  const ref = useRef();

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }, [message]);

  const isOwner = message.senderId === currentUser.uid;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      ref={ref}
      className={`flex items-end gap-3 mb-4 ${isOwner ? "flex-row-reverse" : ""}`}
    >
      <motion.img
        whileHover={{ scale: 1.1 }}
        src={isOwner ? currentUser.photoURL : data.user.photoURL}
        alt="User avatar"
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />

      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className={`
          max-w-[70%] 
          ${
            isOwner
              ? "bg-indigo-500 text-white rounded-l-xl rounded-br-xl"
              : "bg-white text-gray-800 rounded-r-xl rounded-bl-xl shadow-sm border border-gray-100"
          } 
          p-3 
        `}
      >
        {message.text && <p className="break-words">{message.text}</p>}

        {message.img && (
          <motion.img
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            src={message.img}
            alt="Shared content"
            className="mt-2 rounded-lg max-w-full h-auto object-cover"
          />
        )}
      </motion.div>
    </motion.div>
  );
};

export default Message;
