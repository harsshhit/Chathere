import React, { useContext, useState, useEffect } from "react";
import { ArrowLeft, X, MessageSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, getDoc } from "firebase/firestore";
import Messages from "./Messages";
import Input from "./Input";
import { ChatContext } from "../context/ChatContext";
import { useUI } from "../context/UIContext";
import { db } from "../firebase";
import Avatar from "./Avatar";

const Chat = () => {
  const { data } = useContext(ChatContext);
  const { setIsMobileView } = useUI();
  const [showUserModal, setShowUserModal] = useState(false);
  const [userDetails, setUserDetails] = useState(null);

  const handleBack = () => setIsMobileView(true);

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (data.user?.uid && !data.user?.isGroup) {
        const userDoc = await getDoc(doc(db, "users", data.user.uid));
        if (userDoc.exists()) setUserDetails(userDoc.data());
      }
    };
    if (showUserModal) fetchUserDetails();
  }, [showUserModal, data.user?.uid, data.user?.isGroup]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col"
      style={{ background: "var(--surface)" }}
    >
      {data.chatId ? (
        <>
          {/* Chat Header */}
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{
              background: "var(--surface-2)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-3">
              {/* Mobile back */}
              <button
                className="md:hidden icon-btn -ml-1 mr-1"
                onClick={handleBack}
              >
                <ArrowLeft size={20} />
              </button>

              {/* Avatar + name */}
              <button
                className="flex items-center gap-3 group"
                onClick={() => setShowUserModal(true)}
              >
                <Avatar
                    src={data.user?.photoURL}
                    alt={data.user?.displayName}
                    className="w-10 h-10 rounded-2xl object-cover transition-transform duration-200 group-hover:scale-105"
                    style={{ border: "1.5px solid rgba(99,102,241,0.3)" }}
                  />
                <div className="text-left">
                  <p
                    className="text-sm font-semibold leading-tight transition-colors duration-200 group-hover:text-indigo-300"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {data.user?.displayName}
                  </p>
                </div>
              </button>
            </div>


          </motion.div>

          {/* Messages area */}
          <div className="flex-1 overflow-hidden">
            <Messages />
          </div>

          {/* Input */}
          <div
            className="flex-shrink-0"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <Input />
          </div>
        </>
      ) : (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex items-center justify-center p-8"
        >
          <div className="text-center max-w-xs">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(167,139,250,0.2))",
                border: "1px solid rgba(99,102,241,0.25)",
                boxShadow: "0 0 60px rgba(99,102,241,0.1)",
              }}
            >
              <MessageSquare size={32} style={{ color: "var(--primary-light)" }} />
            </div>
            <h2
              className="text-lg font-semibold mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Your messages
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Select a conversation from the sidebar or search for someone new to start chatting.
            </p>
          </div>
        </motion.div>
      )}

      {/* User detail modal */}
      <AnimatePresence>
        {showUserModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowUserModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="glass-card p-8 w-full max-w-sm relative text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowUserModal(false)}
                className="absolute top-4 right-4 icon-btn"
              >
                <X size={18} />
              </button>

              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <Avatar
                    src={data.user?.photoURL}
                    alt={data.user?.displayName}
                    className="w-24 h-24 rounded-3xl object-cover"
                    style={{
                      border: "2px solid rgba(99,102,241,0.5)",
                      boxShadow: "0 0 40px rgba(99,102,241,0.3)",
                    }}
                  />
                </div>

                <div>
                  <h2
                    className="text-xl font-bold mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {data.user?.displayName}
                  </h2>
                  {!data.user?.isGroup && (
                    <p className="text-sm" style={{ color: "var(--primary-light)" }}>
                      {data.user?.email}
                    </p>
                  )}
                </div>

                {!data.user?.isGroup && userDetails?.bio && (
                  <div
                    className="w-full px-4 py-3 rounded-xl text-sm"
                    style={{
                      background: "var(--surface-3)",
                      color: "var(--text-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {userDetails.bio}
                  </div>
                )}

                {data.user?.isGroup && data.user?.members && (
                  <div className="w-full mt-2 text-left">
                    <h3 className="text-[10px] uppercase font-bold text-gray-500 mb-2 tracking-wider pl-1">Members ({data.user.members.length})</h3>
                    <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                       {data.user.members.map((member) => (
                         <div key={member.uid} className="flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
                           <Avatar src={member.photoURL} alt={member.displayName} className="w-8 h-8 rounded-full" />
                           <span className="text-sm font-medium flex-1 truncate">{member.displayName}</span>
                           {data.user?.admin === member.uid && <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold">Admin</span>}
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Chat;
