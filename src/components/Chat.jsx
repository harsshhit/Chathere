import React, { useContext, useState, useEffect } from "react";
import { ArrowLeft, X, MessageSquare, MessageSquareOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import Messages from "./Messages";
import Input from "./Input";
import { ChatContext } from "../context/ChatContext";
import { db } from "../firebase";
import Avatar from "./Avatar";

const ChatSkeleton = ({ onBack }) => (
  <div className="h-full flex flex-col" style={{ background: "var(--surface)" }}>
    {/* Skeleton Header */}
    <div
      className="flex items-center justify-between px-4 py-3 flex-shrink-0 safe-top"
      style={{
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-3">
        <button
          className="md:hidden icon-btn -ml-1 mr-1"
          onClick={onBack}
          aria-label="Back to chats"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="w-10 h-10 rounded-2xl bg-[var(--surface-3)] animate-pulse" />
        <div className="space-y-1.5">
          <div className="w-28 h-3.5 rounded-md bg-[var(--surface-3)] animate-pulse" />
          <div className="w-16 h-2.5 rounded-md bg-[var(--surface-3)] animate-pulse" />
        </div>
      </div>
    </div>

    {/* Skeleton Messages Body */}
    <div className="flex-1 p-4 space-y-4 overflow-hidden">
      <div className="flex items-end gap-2.5 max-w-[60%]">
        <div className="w-7 h-7 rounded-full bg-[var(--surface-3)] animate-pulse flex-shrink-0" />
        <div className="w-44 h-10 rounded-2xl bg-[var(--surface-3)] animate-pulse" />
      </div>
      <div className="flex items-end gap-2.5 max-w-[60%] ml-auto flex-row-reverse">
        <div className="w-7 h-7 rounded-full bg-[var(--surface-3)] animate-pulse flex-shrink-0" />
        <div className="w-56 h-14 rounded-2xl bg-[var(--surface-3)] animate-pulse" />
      </div>
      <div className="flex items-end gap-2.5 max-w-[60%]">
        <div className="w-7 h-7 rounded-full bg-[var(--surface-3)] animate-pulse flex-shrink-0" />
        <div className="w-36 h-9 rounded-2xl bg-[var(--surface-3)] animate-pulse" />
      </div>
    </div>

    {/* Skeleton Input */}
    <div
      className="px-4 py-3 flex-shrink-0 safe-bottom"
      style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}
    >
      <div className="h-10 rounded-full bg-[var(--surface-3)] animate-pulse" />
    </div>
  </div>
);

const ChatNotFound = ({ onBack }) => (
  <div className="h-full flex flex-col items-center justify-center p-6 text-center" style={{ background: "var(--surface)" }}>
    <div
      className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
      style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
    >
      <MessageSquareOff size={28} style={{ color: "var(--text-muted)" }} />
    </div>
    <h2 className="text-base font-bold mb-1.5" style={{ color: "var(--text-primary)" }}>
      Conversation Not Found
    </h2>
    <p className="text-xs max-w-xs mb-5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
      This chat could not be found, or you may not have access to it.
    </p>
    <button
      onClick={onBack}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
      style={{ touchAction: "manipulation" }}
    >
      <ArrowLeft size={14} /> Back to Chats
    </button>
  </div>
);

const Chat = () => {
  const { data, loadingChat, chatNotFound } = useContext(ChatContext);
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [showUserModal, setShowUserModal] = useState(false);
  const [userDetails, setUserDetails] = useState(null);

  // Hardware/browser back button calls navigate(-1) (fallback to "/" if no history)
  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  useEffect(() => {
    const fetchUserDetails = async () => {
      if (data.user?.uid && !data.user?.isGroup) {
        try {
          const userDoc = await getDoc(doc(db, "users", data.user.uid));
          if (userDoc.exists()) setUserDetails(userDoc.data());
        } catch (err) {
          console.error("Error fetching user details:", err);
        }
      }
    };
    if (showUserModal) fetchUserDetails();
  }, [showUserModal, data.user?.uid, data.user?.isGroup]);

  const hasChatTarget = Boolean(chatId || (data.chatId && data.chatId !== "null"));

  // Loading skeleton while resolving chat from URL
  if (hasChatTarget && loadingChat) {
    return <ChatSkeleton onBack={handleBack} />;
  }

  // Friendly not found state for invalid / non-existent chatId
  if (hasChatTarget && chatNotFound) {
    return <ChatNotFound onBack={handleBack} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="h-full flex flex-col flex-1 min-h-0 w-full overflow-hidden"
      style={{
        background: "var(--surface)",
        height: "var(--app-height, 100dvh)",
      }}
    >
      {hasChatTarget && data.user ? (
        <>
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0 safe-top"
            style={{
              background: "var(--surface-2)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-3">
              <button
                className="md:hidden icon-btn -ml-1 mr-1"
                onClick={handleBack}
                aria-label="Back to chats"
                style={{ touchAction: "manipulation" }}
              >
                <ArrowLeft size={20} />
              </button>

              <button
                className="flex items-center gap-3 group text-left"
                onClick={() => setShowUserModal(true)}
                style={{ touchAction: "manipulation" }}
              >
                <Avatar
                  src={data.user?.photoURL}
                  name={data.user?.displayName}
                  size={40}
                  className="w-10 h-10 rounded-2xl object-cover transition-transform duration-200"
                  style={{ border: "1.5px solid rgba(99,102,241,0.3)" }}
                />
                <div className="text-left">
                  <p
                    className="text-sm font-semibold leading-tight transition-colors duration-200"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {data.user?.displayName || "Chat"}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div
            className="flex-1 min-h-0 overflow-hidden flex flex-col"
            style={{ overscrollBehavior: "contain" }}
          >
            <Messages key={data.chatId || "chat"} />
          </div>

          <div
            className="shrink-0 safe-bottom"
            style={{
              borderTop: "1px solid var(--border)",
              paddingBottom: "env(safe-area-inset-bottom)",
            }}
          >
            <Input />
          </div>
        </>
      ) : (
        /* Empty placeholder on desktop when at "/" */
        <div className="flex-1 flex items-center justify-center p-8">
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
        </div>
      )}

      {/* User details modal with mobile-optimized solid background */}
      <AnimatePresence>
        {showUserModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "var(--overlay)" }}
            onClick={() => setShowUserModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="glass-card p-6 sm:p-8 w-full max-w-sm relative text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowUserModal(false)}
                className="absolute top-4 right-4 icon-btn"
                aria-label="Close"
                style={{ touchAction: "manipulation" }}
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
                      boxShadow: "0 0 30px rgba(99,102,241,0.25)",
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
                    <h3 className="text-[10px] uppercase font-bold text-[var(--text-muted)] mb-2 tracking-wider pl-1">
                      Members ({data.user.members.length})
                    </h3>
                    <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                      {data.user.members.map((member) => (
                        <div
                          key={member.uid}
                          className="flex items-center gap-3 p-2 rounded-xl transition-colors"
                          style={{ background: "var(--subtle)" }}
                        >
                          <Avatar src={member.photoURL} alt={member.displayName} className="w-8 h-8 rounded-full" />
                          <span className="text-sm font-medium flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                            {member.displayName}
                          </span>
                          {data.user?.admin === member.uid && (
                            <span className="text-[10px] bg-indigo-500/20 text-[var(--primary-light)] px-2 py-0.5 rounded-full font-bold">
                              Admin
                            </span>
                          )}
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
