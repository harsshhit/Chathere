import React, { useContext, useState, useEffect } from "react";
import { ArrowLeftCircle, PhoneCall, Video, Settings2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, getDoc } from "firebase/firestore";
import Messages from "./Messages";
import Input from "./Input";
import { ChatContext } from "../context/ChatContext";
import { useUI } from "../context/UIContext";
import { db } from "../firebase";

const Chat = () => {
  const { data } = useContext(ChatContext);
  const { setIsMobileView } = useUI();
  const [showUserModal, setShowUserModal] = useState(false);
  const [userDetails, setUserDetails] = useState(null);

  const handleBack = () => {
    setIsMobileView(true);
  };

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (data.user?.uid) {
        const userDoc = await getDoc(doc(db, "users", data.user.uid));
        if (userDoc.exists()) {
          setUserDetails(userDoc.data());
        }
      }
    };

    if (showUserModal) {
      fetchUserDetails();
    }
  }, [showUserModal, data.user?.uid]);

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
        className="bg-gradient-to-br from-blue-50 to-indigo-50 min-h-[10vh]    p-4 flex items-center justify-between sticky top-0  "
      >
        <div className="flex items-center space-x-4 ">
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
                className="w-12 h-12 rounded-full object-cover border-2 border-blue-200 shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer"
                onClick={() => setShowUserModal(true)}
              />
              <span
                className="font-bold text-gray-800 text-lg line-clamp-1 hover:text-blue-600 transition-colors duration-200 cursor-pointer"
                onClick={() => setShowUserModal(true)}
              >
                {data.user?.displayName}
              </span>
            </div>
          )}
        </div>

        {/* <div className="flex items-center space-x-2 md:space-x-3">
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
        </div> */}
      </motion.div>

      <AnimatePresence>
        {showUserModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={() => setShowUserModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-lg relative border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                onClick={() => setShowUserModal(false)}
              >
                <X size={24} />
              </button>
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-200 rounded-full blur-md opacity-20 animate-pulse"></div>
                  <motion.img
                    whileHover={{ scale: 1.05 }}
                    src={data.user?.photoURL}
                    alt={data.user?.displayName}
                    className="relative w-32 h-32 rounded-full object-cover border-4 border-blue-100 shadow-md ring-2 ring-blue-200"
                  />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">
                  {data.user?.displayName}
                </h2>
                <div className="space-y-3 text-center w-full px-4">
                  <p className="text-gray-700 bg-blue-50 py-2 px-4 rounded-lg">
                    {data.user?.email}
                  </p>
                  <p className="text-gray-600 bg-gray-50 py-3 px-4 rounded-lg">
                    {userDetails?.bio || "No bio available"}
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
