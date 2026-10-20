import React, { useContext } from "react";
import { ArrowLeft, MessageSquare, MessageSquareOff } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import Messages from "./Messages";
import Input from "./Input";
import { ChatContext, ContactPanelContext } from "../context/ChatContext";
import Avatar from "./Avatar";
import ContactPanel from "./ContactPanel";

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
  const { contactPanel, openContactPanel } = useContext(ContactPanelContext);
  const { chatId } = useParams();
  const navigate = useNavigate();

  // Hardware/browser back button calls navigate(-1) (fallback to "/" if no history)
  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  const hasChatTarget = Boolean(chatId || (data.chatId && data.chatId !== "null"));

  const showMessageInChat = (messageId) => {
    if (!messageId) return;
    window.setTimeout(() => {
      const target = document.getElementById(`msg-${messageId}`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      const previousOutline = target.style.outline;
      target.style.outline = "3px solid rgba(99,102,241,0.75)";
      window.setTimeout(() => { target.style.outline = previousOutline; }, 1400);
    }, 80);
  };

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
      className="h-full flex flex-row flex-1 min-h-0 w-full overflow-hidden"
      style={{
        background: "var(--surface)",
        height: "var(--app-height, 100dvh)",
      }}
    >
      {hasChatTarget && data.user ? (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
                type="button"
                onClick={() => openContactPanel(data.user)}
                style={{ touchAction: "manipulation" }}
                aria-label={`Open ${data.user?.displayName || "chat"} information`}
                className="flex items-center gap-3 group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
        </div>
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

      {contactPanel.open && <ContactPanel onFocusMessage={() => window.setTimeout(() => document.getElementById("chat-message-input")?.focus(), 50)} onShowInChat={showMessageInChat} />}
    </motion.div>
  );
};

export default Chat;
