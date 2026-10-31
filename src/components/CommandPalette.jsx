import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Search, X, Keyboard } from "lucide-react";
import { UserChatsMetadataContext } from "../context/ChatContexts";
import { AuthContext } from "../context/AuthContext";

const isEditable = (target) => target instanceof HTMLElement && (
  target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
);

const CommandPalette = ({ initialMode = "" }) => {
  const navigate = useNavigate();
  const chats = useContext(UserChatsMetadataContext);
  const { currentUser } = useContext(AuthContext);
  const [open, setOpen] = useState(initialMode === "palette");
  const [helpOpen, setHelpOpen] = useState(initialMode === "help");
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef(null);
  const inputRef = useRef(null);

  const orderedChats = useMemo(() => Object.entries(chats || {})
    .filter(([, chat]) => chat?.userInfo)
    .sort((a, b) => (b[1]?.date?.seconds || b[1]?.lastMessage?.date || 0) - (a[1]?.date?.seconds || a[1]?.lastMessage?.date || 0)), [chats]);

  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const actions = [
      { id: "help", label: "Shortcuts help", icon: Keyboard, run: () => setHelpOpen(true) },
    ];
    const matches = [
      ...actions.filter((item) => !normalized || item.label.toLowerCase().includes(normalized)),
      ...orderedChats.filter(([, chat]) => (chat.userInfo.displayName || "").toLowerCase().includes(normalized)).map(([chatId, chat]) => ({
        id: `chat-${chatId}`,
        label: chat.userInfo.displayName || "Chat",
        detail: chat.lastMessage?.text || "Conversation",
        icon: MessageCircle,
        run: () => navigate(`/chat/${chatId}`),
      })),
    ];
    return matches.slice(0, 8);
  }, [navigate, orderedChats, query]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setActiveIndex(0);
        setOpen(true);
        return;
      }
      if (event.key === "?" && !isEditable(event.target) && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      if ((event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) && !isEditable(event.target) && orderedChats.length) {
        event.preventDefault();
        const currentId = window.location.pathname.match(/^\/chat\/([^/]+)/)?.[1];
        const currentIndex = orderedChats.findIndex(([id]) => id === currentId);
        const step = event.key === "ArrowUp" ? -1 : 1;
        const nextIndex = currentIndex < 0 ? 0 : (currentIndex + step + orderedChats.length) % orderedChats.length;
        navigate(`/chat/${orderedChats[nextIndex][0]}`);
        return;
      }
      if (event.key === "Escape" && helpOpen) setHelpOpen(false);
      else if (event.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [helpOpen, navigate, open, orderedChats]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  const runResult = (item) => {
    setOpen(false);
    item.run();
  };

  const handleDialogKeyDown = (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!results.length) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + direction + results.length) % results.length);
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      runResult(results[activeIndex]);
    } else if (event.key === "Tab") {
      const focusable = dialogRef.current?.querySelectorAll("input,button:not([disabled])");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  if (!currentUser) return null;

  return <>
    {open && <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/45 px-4 pt-[12vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={handleDialogKeyDown} className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4">
          <Search size={18} className="text-[var(--text-muted)]" />
          <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chats and actions" aria-label="Search chats and actions" className="h-14 min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]" />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close command palette" className="rounded-md p-2 text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><X size={17} /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {results.length ? results.map((item, index) => {
            const Icon = item.icon;
            return <button key={item.id} type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => runResult(item)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${index === activeIndex ? "bg-[var(--hover)]" : ""}`}>
              <Icon size={17} className="shrink-0 text-[var(--primary-light)]" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[var(--text-primary)]">{item.label}</span>{item.detail && <span className="block truncate text-xs text-[var(--text-muted)]">{item.detail}</span>}</span>
            </button>;
          }) : <p className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">No matching results</p>}
        </div>
        <div className="border-t border-[var(--border)] px-4 py-2 text-[11px] text-[var(--text-muted)]">↑↓ Navigate <span className="mx-2">·</span> Enter Open <span className="mx-2">·</span> Esc Close</div>
      </section>
    </div>}
    {helpOpen && <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/45 px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setHelpOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-semibold text-[var(--text-primary)]">Keyboard shortcuts</h2><button onClick={() => setHelpOpen(false)} aria-label="Close shortcuts help" className="rounded-md p-2 text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><X size={17} /></button></div>
        <dl className="space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-[var(--text-secondary)]">Command palette</dt><dd className="text-[var(--text-primary)]">Ctrl/Cmd + K</dd></div><div className="flex justify-between gap-4"><dt className="text-[var(--text-secondary)]">Previous / next chat</dt><dd className="text-[var(--text-primary)]">Alt + ↑ / ↓</dd></div><div className="flex justify-between gap-4"><dt className="text-[var(--text-secondary)]">Shortcuts help</dt><dd className="text-[var(--text-primary)]">?</dd></div><div className="flex justify-between gap-4"><dt className="text-[var(--text-secondary)]">Close panels</dt><dd className="text-[var(--text-primary)]">Esc</dd></div></dl>
      </section>
    </div>}
  </>;
};

export default CommandPalette;