import React, { useContext } from "react";
import { ArrowLeft, Phone, Video, MoreVertical } from "lucide-react";
import { motion } from "framer-motion";
import Messages from "./Messages";
import Input from "./Input";
import { ChatContext } from "../context/ChatContext";
import { useUI } from "../context/UIContext";

const Chat = () => {
  const { data } = useContext(ChatContext);
  const { setIsMobileView } = useUI();

  const handleBack = () => {
    setIsMobileView(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col bg-white md:bg-transparent"
    >
      <motion.div 
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        className="bg-white shadow-sm border-b border-gray-100 p-4 flex items-center justify-between sticky top-0 z-10"
      >
        <div className="flex items-center space-x-4">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="md:hidden text-gray-600 hover:text-indigo-600 p-2 -ml-2 rounded-full hover:bg-gray-50"
            onClick={handleBack}
          >
            <ArrowLeft size={24} />
          </motion.button>

          {data.user?.photoURL && (
            <div className="flex items-center space-x-3">
              <motion.img
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                src={data.user?.photoURL}
                alt={data.user?.displayName}
                className="w-10 h-10 rounded-full object-cover border-2 border-indigo-100"
              />
              <span className="font-semibold text-gray-800 line-clamp-1">
                {data.user?.displayName}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 md:space-x-4">
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Phone className="w-8 h-8 p-1.5 text-gray-600 hover:text-green-500 transition-colors hover:bg-gray-50 rounded-full" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Video className="w-8 h-8 p-1.5 text-gray-600 hover:text-indigo-500 transition-colors hover:bg-gray-50 rounded-full" />
          </motion.button>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <MoreVertical className="w-8 h-8 p-1.5 text-gray-600 hover:text-indigo-600 transition-colors hover:bg-gray-50 rounded-full" />
          </motion.button>
        </div>
      </motion.div>

      {data.chatId ? (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 overflow-y-auto bg-gray-50"
          >
            <Messages />
          </motion.div>
          <motion.div 
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            className="bg-white border-t border-gray-100"
          >
            <Input />
          </motion.div>
        </>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex items-center justify-center bg-gray-50"
        >
          <div className="text-center text-gray-500">
            <p className="text-xl">Select a chat to start messaging</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Chat;
