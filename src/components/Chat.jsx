import React, { useContext } from "react";
import { ArrowLeftCircle, PhoneCall, Video, Settings2 } from "lucide-react";
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
      className="h-full flex flex-col bg-white md:bg-transparent rounded-2xl shadow-xl"
    >
      <motion.div
        initial={{ y: -20 }}
        animate={{ y: 0 }}
        className="bg-white shadow-lg border-b border-blue-100 p-4 flex items-center justify-between sticky top-0 z-10 rounded-t-2xl backdrop-blur-sm bg-opacity-90"
      >
        <div className="flex items-center space-x-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="md:hidden text-blue-600 hover:text-blue-700 p-2 -ml-2 rounded-full hover:bg-blue-50 transition-colors duration-200"
            onClick={handleBack}
          >
            <ArrowLeftCircle size={26} />
          </motion.button>

          {data.user?.photoURL && (
            <div className="flex items-center space-x-4">
              <motion.img
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                src={data.user?.photoURL}
                alt={data.user?.displayName}
                className="w-12 h-12 rounded-full object-cover border-2 border-blue-200 shadow-md hover:border-blue-300 transition-all duration-200"
              />
              <span className="font-bold text-gray-800 text-lg line-clamp-1 hover:text-blue-600 transition-colors duration-200">
                {data.user?.displayName}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 md:space-x-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-full hover:bg-green-50 transition-all duration-200 group"
          >
            <PhoneCall className="w-6 h-6 text-blue-600 group-hover:text-green-500 transition-colors duration-200" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-full hover:bg-blue-50 transition-all duration-200 group"
          >
            <Video className="w-6 h-6 text-blue-600 group-hover:text-blue-700 transition-colors duration-200" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-full hover:bg-blue-50 transition-all duration-200 group"
          >
            <Settings2 className="w-6 h-6 text-blue-600 group-hover:text-blue-700 transition-colors duration-200" />
          </motion.button>
        </div>
      </motion.div>

      {data.chatId ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 overflow-y-auto bg-gradient-to-b from-blue-50 to-white"
          >
            <Messages />
          </motion.div>
          <motion.div
            initial={{ y: 20 }}
            animate={{ y: 0 }}
            className="bg-white border-t border-blue-100 rounded-b-2xl shadow-lg backdrop-blur-sm bg-opacity-90"
          >
            <Input />
          </motion.div>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex items-center justify-center bg-gradient-to-b from-blue-50 to-white rounded-b-2xl"
        >
          <div className="text-center p-8 bg-white bg-opacity-80 rounded-2xl shadow-lg backdrop-blur-sm">
            <p className="text-2xl font-bold text-blue-600 animate-pulse">
              Select a chat to start messaging
            </p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Chat;
