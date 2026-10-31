import React, { lazy, Suspense, useContext } from "react";
import { ArrowLeft, MessageSquare, MessageSquareOff } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import Messages from "./Messages";
import Input from "./Input";
import { ChatContext, ContactPanelContext, ContactPanelActionsContext } from "../context/ChatContexts";
import Avatar from "./Avatar";
import { formatTime } from "../utils/formatters";

const ContactPanel = lazy(() => import("./ContactPanel"));

const formatLastSeen = (value) => {
  const time = formatTime(value);
  return time ? `last seen ${time}` : "";
};

const ChatSkeleton = ({ onBack }) => (
  <div className="ember-bg flex h-full flex-col">
    {/* Skeleton Header */}
    <div
      className="glass flex flex-shrink-0 items-center justify-between px-4 py-3"
    >
      <div className="flex items-center gap-3">
        <button
          className="md:hidden icon-btn -ml-1 mr-1"
          onClick={onBack}
          aria-label="Back to chats"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="h-9 w-9 rounded-full bg-[var(--surface-3)] animate-pulse" />
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
      className="glass mx-3 mb-3 rounded-full"
    >
      <div className="h-10 rounded-full bg-[var(--surface-3)] animate-pulse" />
    </div>
  </div>
);

const ChatNotFound = ({ onBack }) => (
  <div className="ember-bg flex h-full flex-col items-center justify-center p-6 text-center">
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
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[var(--on-primary)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors"
      style={{ touchAction: "manipulation" }}
    >
      <ArrowLeft size={14} /> Back to Chats
    </button>
  </div>
);

const Chat = () => {
  const { data, loadingChat, chatNotFound } = useContext(ChatContext);
  const { contactPanel } = useContext(ContactPanelContext);
  const { openContactPanel } = useContext(ContactPanelActionsContext);
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
      target.style.outline = "3px solid var(--primary-border)";
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
        background: "var(--wallpaper)",
        height: "var(--app-height, 100dvh)",
      }}
    >
      {hasChatTarget && data.user ? (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="glass chat-header safe-top flex shrink-0 items-center justify-between gap-2 px-3 py-2.5">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden icon-btn-glass -ml-1"
                onClick={handleBack}
                aria-label="Back to chats"
              >
                <ArrowLeft size={19} />
              </button>

              <button
                type="button"
                onClick={() => openContactPanel(data.user)}
                aria-label={`Open ${data.user?.displayName || "chat"} information`}
                className="flex min-w-0 items-center gap-2.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <Avatar
                  src={data.user?.photoURL}
                  name={data.user?.displayName}
                  size={36}
                  className="h-9 w-9 flex-shrink-0 rounded-full object-cover"
                />
                <div className="min-w-0 text-left">
                  <p className="truncate text-base font-semibold leading-5 text-[var(--text-primary)]">
                    {data.user?.displayName || "Chat"}
                  </p>
                  <p className="max-w-[55vw] truncate text-xs leading-4 text-[var(--text-muted)] md:max-w-[240px]">
                    {data.user?.isGroup
                      ? (data.user.members || []).map((member) => member.displayName).filter(Boolean).join(", ")
                      : data.user?.online === true || data.user?.presence === "online"
                      ? "online"
                      : data.user?.lastSeen
                      ? formatLastSeen(data.user.lastSeen)
                      : data.user?.presence || ""}
                  </p>
                </div>
              </button>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
            </div>
          </div>

          <div
            className="flex-1 min-h-0 overflow-hidden flex flex-col"
            style={{ overscrollBehavior: "contain" }}
          >
            <Messages key={data.chatId || "chat"} />
          </div>

          <div className="shrink-0">
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
                background: "linear-gradient(135deg, var(--primary-soft), var(--primary-soft))",
                border: "1px solid var(--primary-glow)",
                boxShadow: "0 0 60px var(--primary-soft)",
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

      {contactPanel.open && <Suspense fallback={<div className="fixed inset-y-0 right-0 z-50 w-full max-w-[440px] bg-[var(--surface-2)] p-4" aria-label="Loading contact panel"><div className="mb-6 h-8 w-32 animate-pulse rounded-lg bg-[var(--surface-3)]" /><div className="mx-auto mb-4 h-24 w-24 animate-pulse rounded-full bg-[var(--surface-3)]" /><div className="h-40 animate-pulse rounded-2xl bg-[var(--surface-3)]" /></div>}><ContactPanel onFocusMessage={() => window.setTimeout(() => document.getElementById("chat-message-input")?.focus(), 50)} onShowInChat={showMessageInChat} /></Suspense>}
    </motion.div>
  );
};

export default Chat;
