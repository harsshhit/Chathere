import React, { memo, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { doc, getDoc } from "firebase/firestore";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Download, File, FileAudio,
  FileImage, FileVideo, Info, Link as LinkIcon, MessageCircle, Play, Users, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ChatContext, ContactPanelContext, UserChatsContext } from "../context/ChatContext";
import { db } from "../firebase";
import Avatar from "./Avatar";
import { optimizeUrl } from "../utils/cloudinary";
import { getChatMessages, subscribeChatMessages } from "../utils/chatMessagesStore";

const userCache = new Map();
const TAB_PAGE_SIZE = 60;

const dateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = value instanceof Date ? value : new Date(typeof value === "number" ? value : value.seconds ? value.seconds * 1000 : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateLabel = (value) => dateValue(value)?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) || "";
const monthLabel = (value) => dateValue(value)?.toLocaleDateString(undefined, { month: "long", year: "numeric" }) || "Unknown date";
const durationLabel = (duration) => {
  if (!Number.isFinite(duration) || duration <= 0) return "";
  const totalSeconds = Math.floor(duration);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
};
const bytesLabel = (size) => {
  if (!Number.isFinite(size) || size <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let amount = size;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1; }
  return `${amount >= 10 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
};

const safeUrl = (value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch { return null; }
};

const useLoadedMessages = (chatId) => useSyncExternalStore(
  (listener) => subscribeChatMessages(chatId, listener),
  () => getChatMessages(chatId),
  () => []
);

const ContactAvatar = memo(function ContactAvatar({ user, onOpen }) {
  const [loading, setLoading] = useState(Boolean(user.photoURL));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setLoading(Boolean(user.photoURL));
    setFailed(false);
  }, [user.photoURL]);
  return <button type="button" onClick={onOpen} className="relative mx-auto mb-3 block h-28 w-28 overflow-hidden rounded-full bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" aria-label="Open profile photo">
    {loading && <span className="absolute inset-0 animate-pulse rounded-full bg-[var(--surface-4)]" />}
    {!failed && user.photoURL ? <img src={optimizeUrl(user.photoURL, 800)} alt={user.displayName || "Profile photo"} className="relative h-full w-full rounded-full object-cover" loading="lazy" onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} /> : <Avatar name={user.displayName} size={112} className="relative h-28 w-28 rounded-full" />}
  </button>;
});

const SkeletonRows = () => <div className="space-y-3" aria-label="Loading contact information">
  {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-[var(--surface-3)]" />)}
</div>;

const MediaTile = memo(function MediaTile({ item, onOpen }) {
  const isVideo = item.kind === "video";
  const src = item.message.img || item.message.file?.url;
  const optimized = optimizeUrl(src, 300);
  const thumb = isVideo && optimized ? optimized.replace("/upload/f_auto,q_auto,w_300/", "/upload/so_0,f_jpg,q_auto,w_300/") : optimized;
  const [failed, setFailed] = useState(false);
  return <button type="button" onClick={onOpen} className="group relative aspect-square min-w-0 overflow-hidden rounded-md bg-[var(--surface-3)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500" aria-label={`Open ${isVideo ? "video" : item.kind === "gif" ? "GIF" : "image"}`}>
    {!failed && thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" onError={() => setFailed(true)} /> : <span className="flex h-full items-center justify-center px-2 text-center text-xs text-[var(--text-muted)]">Image unavailable</span>}
    {isVideo && <span className="absolute inset-0 flex items-center justify-center bg-black/15 text-white"><Play size={23} fill="currentColor" /><span className="sr-only">Video</span>{durationLabel(item.message.file?.duration) && <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] tabular-nums">{durationLabel(item.message.file.duration)}</span>}</span>}
  </button>;
});

const SharedContent = memo(function SharedContent({ tab, items, onMediaOpen, onShowInChat }) {
  const [pageCount, setPageCount] = useState(1);
  const sentinelRef = useRef(null);
  useEffect(() => setPageCount(1), [tab, items]);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setPageCount((count) => Math.min(count + 1, Math.ceil(items.length / TAB_PAGE_SIZE)));
    }, { rootMargin: "240px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, tab]);

  if (tab === "media" || tab === "gifs") {
    if (!items.length) return <EmptyShared />;
    const visibleItems = items.slice(0, pageCount * TAB_PAGE_SIZE);
    const groups = [];
    visibleItems.forEach((item) => {
      const month = monthLabel(item.message.date);
      const lastGroup = groups[groups.length - 1];
      if (!lastGroup || lastGroup.month !== month) groups.push({ month, items: [item] });
      else lastGroup.items.push(item);
    });
    return <div className="space-y-3">
      {groups.map((group) => <section key={group.month}>
        <h3 className="sticky top-[42px] z-[1] -mx-4 bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)]">{group.month}</h3>
        <div className="grid grid-cols-3 gap-0.5">{group.items.map((item, index) => <MediaTile key={item.message.id || `${item.kind}-${index}`} item={item} onOpen={() => onMediaOpen(item.viewerIndex)} />)}</div>
      </section>)}
      <div ref={sentinelRef} className="h-2" aria-hidden="true" />
    </div>;
  }

  if (!items.length) return <EmptyShared />;
  if (tab === "files") return <div className="divide-y divide-[var(--border)]">{items.map((item, index) => {
    const file = item.message.file || {};
    const Icon = file.mime?.startsWith("image/") ? FileImage : file.mime?.startsWith("video/") ? FileVideo : file.mime?.startsWith("audio/") ? FileAudio : File;
    return <a key={item.message.id || index} href={file.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
      <Icon size={19} className="shrink-0 text-[var(--primary-light)]" />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[var(--text-primary)]">{file.name || "Attachment"}</span><span className="text-xs text-[var(--text-muted)]">{bytesLabel(file.size)}{file.size ? " · " : ""}{dateLabel(item.message.date)}</span></span>
      <Download size={16} className="shrink-0 text-[var(--text-muted)]" />
    </a>;
  })}</div>;
  if (tab === "links") return <div className="divide-y divide-[var(--border)]">{items.map((item, index) => <a key={`${item.message.id}-${index}`} href={item.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-start gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
    <LinkIcon size={17} className="mt-0.5 shrink-0 text-[var(--primary-light)]" />
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{new URL(item.url).hostname}</span><span className="block truncate text-xs text-[var(--text-secondary)]">{item.url}</span><span className="mt-1 block text-[11px] text-[var(--text-muted)]">{dateLabel(item.message.date)}</span></span>
  </a>)}</div>;
  return <div className="divide-y divide-[var(--border)]">{items.map((item, index) => {
    const audio = item.message.file?.url;
    return <AudioMessageRow key={item.message.id || index} item={item} audio={audio} onShowInChat={onShowInChat} />;
  })}</div>;
});

const AudioMessageRow = memo(function AudioMessageRow({ item, audio, onShowInChat }) {
  const [duration, setDuration] = useState(item.message.file?.duration || 0);
  return <div className="flex min-w-0 items-center gap-3 py-3">
    <FileAudio size={19} className="shrink-0 text-[var(--primary-light)]" />
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[var(--text-primary)]">{item.message.file?.name || "Audio message"}</p><p className="text-xs text-[var(--text-muted)]">{durationLabel(duration)}{durationLabel(duration) ? " · " : ""}{dateLabel(item.message.date)}</p><audio src={audio} controls preload="metadata" className="contact-panel-audio mt-2 h-9 w-full" onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onPlay={(event) => { document.querySelectorAll(".contact-panel-audio").forEach((element) => { if (element !== event.currentTarget) element.pause(); }); }} /></div>
    <button type="button" onClick={() => onShowInChat?.(item.message.id)} className="icon-btn shrink-0" aria-label="Show audio in chat"><MessageCircle size={16} /></button>
  </div>;
});

const EmptyShared = () => <p className="py-12 text-center text-sm text-[var(--text-muted)]">No shared media yet</p>;

const ContactPanel = memo(function ContactPanel({ onFocusMessage, onShowInChat }) {
  const context = useContext(ChatContext);
  const panelContext = useContext(ContactPanelContext);
  const userChats = useContext(UserChatsContext);
  const navigate = useNavigate();
  const { data, dispatch } = context;
  const { contactPanel, closeContactPanel, openContactPanelUser, backContactPanel } = panelContext;
  const target = contactPanel.user;
  const messages = useLoadedMessages(data.chatId);
  const reduceMotion = useReducedMotion();
  const [details, setDetails] = useState(() => target?.uid ? userCache.get(target.uid)?.data || null : null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState("media");
  const [copied, setCopied] = useState(false);
  const [viewer, setViewer] = useState(null);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const heroRef = useRef(null);
  const stickyRef = useRef(null);
  const triggerRef = useRef(null);
  const viewerCloseRef = useRef(null);
  const viewerTriggerRef = useRef(null);
  const viewerStateRef = useRef(viewer);
  const [showSticky, setShowSticky] = useState(false);
  const [isMobilePanel, setIsMobilePanel] = useState(() => typeof window !== "undefined" && window.innerWidth < 1024);
  const isViewerOpen = Boolean(viewer);
  viewerStateRef.current = viewer;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const update = (event) => setIsMobilePanel(event.matches);
    setIsMobilePanel(mediaQuery.matches);
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!contactPanel.open || !target?.uid || target.isGroup) return undefined;
    let cancelled = false;
    const cached = userCache.get(target.uid);
    setDetails(cached?.data || null);
    if (cached?.data) {
      setDetails(cached.data);
      setLoadingDetails(false);
      return undefined;
    }
    setLoadingDetails(true);
    const pending = cached?.promise || getDoc(doc(db, "users", target.uid)).then((snapshot) => snapshot.exists() ? snapshot.data() : {}).then((userData) => {
      userCache.set(target.uid, { data: userData });
      return userData;
    }).catch((error) => {
      userCache.delete(target.uid);
      throw error;
    });
    if (!cached) userCache.set(target.uid, { promise: pending });
    pending.then((userData) => { if (!cancelled) setDetails(userData); }).catch((error) => console.error("Error fetching contact details:", error)).finally(() => { if (!cancelled) setLoadingDetails(false); });
    return () => { cancelled = true; };
  }, [contactPanel.open, target?.uid, target?.isGroup]);

  useEffect(() => {
    if (!contactPanel.open) return undefined;
    triggerRef.current = document.activeElement;
    requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (viewerStateRef.current) setViewer(null);
        else closeContactPanel();
      }
      if (event.key === "Tab" && !viewerStateRef.current && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll('button:not([disabled]), a[href], audio[controls], [tabindex="0"]');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      requestAnimationFrame(() => triggerRef.current?.focus?.());
    };
  }, [contactPanel.open, target?.uid, closeContactPanel]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(([entry]) => setShowSticky(!entry.isIntersecting), { threshold: 0.1 });
    if (heroRef.current) observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, [contactPanel.open, target?.uid]);

  useEffect(() => {
    if (!isViewerOpen) return undefined;
    requestAnimationFrame(() => viewerCloseRef.current?.focus());
    const onKeyDown = (event) => {
      if (event.key === "ArrowLeft") setViewer((current) => ({ ...current, index: (current.index - 1 + current.items.length) % current.items.length }));
      if (event.key === "ArrowRight") setViewer((current) => ({ ...current, index: (current.index + 1) % current.items.length }));
      if (event.key === "Tab") {
        const viewerElement = viewerCloseRef.current?.closest('[role="dialog"]');
        const focusable = viewerElement?.querySelectorAll('button:not([disabled]), a[href]');
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isViewerOpen]);

  useEffect(() => {
    if (viewer) return undefined;
    viewerTriggerRef.current?.focus?.();
    viewerTriggerRef.current = null;
    return undefined;
  }, [viewer]);

  const content = useMemo(() => {
    const media = [];
    const gifs = [];
    const files = [];
    const links = [];
    const voice = [];
    const ordered = [...messages].filter((message) => message && message.status !== "sending").reverse();
    ordered.forEach((message) => {
      const file = message.file || {};
      if (message.img) {
        const item = { message, kind: message.type === "image" ? "image" : "gif" };
        if (item.kind === "image") media.push(item);
        else gifs.push(item);
      }
      if (file.url && file.mime?.startsWith("video/")) media.push({ message, kind: "video" });
      else if (file.url && file.mime?.startsWith("audio/")) voice.push({ message });
      else if (file.url) files.push({ message });
      if (typeof message.text === "string") {
        const matches = message.text.match(/https?:\/\/[^\s<>{}"']+/gi) || [];
        matches.forEach((candidate) => {
          const url = safeUrl(candidate.replace(/[),.!?;:]+$/, ""));
          if (url) links.push({ message, url });
        });
      }
    });
    media.forEach((item, index) => { item.viewerIndex = index; });
    const mediaViewerItems = media.map((item) => ({ ...item, src: item.message.img || item.message.file?.url, original: item.message.img || item.message.file?.url }));
    gifs.forEach((item, index) => { item.viewerIndex = index; });
    return { media, gifs, files, links, voice, mediaViewerItems };
  }, [messages]);

  const commonGroups = useMemo(() => {
    if (!target?.uid || target.isGroup) return [];
    return Object.entries(userChats || {}).filter(([chatId, entry]) => {
      const group = entry?.userInfo;
      return group?.isGroup && group.members?.some((member) => member.uid === target.uid) && chatId !== data.chatId;
    }).map(([chatId, entry]) => ({ chatId, group: entry.userInfo }));
  }, [target?.uid, target?.isGroup, userChats, data.chatId]);

  const tabs = useMemo(() => {
    const available = [{ id: "media", label: "Media", count: content.media.length }];
    if (content.files.length) available.push({ id: "files", label: "Files", count: content.files.length });
    if (content.links.length) available.push({ id: "links", label: "Links", count: content.links.length });
    if (content.voice.length) available.push({ id: "voice", label: "Voice", count: content.voice.length });
    if (content.gifs.length) available.push({ id: "gifs", label: "GIFs", count: content.gifs.length });
    if (target?.isGroup && target.members?.length) available.push({ id: "members", label: "Members", count: target.members.length });
    else if (commonGroups.length) available.push({ id: "groups", label: "Groups", count: commonGroups.length });
    return available;
  }, [content, target?.isGroup, target?.members, commonGroups.length]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) setActiveTab("media");
  }, [tabs, activeTab]);

  const openViewer = (items, index) => {
    viewerTriggerRef.current = document.activeElement;
    setViewer({ items, index, startX: null });
  };
  const openAvatar = () => openViewer([{ src: target?.photoURL, original: target?.photoURL, message: { senderName: target?.displayName, date: null }, kind: "image" }], 0);
  const closePanel = () => { setViewer(null); closeContactPanel(); };
  const copyValue = async (value) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { /* Clipboard can be unavailable in insecure browser contexts. */ }
  };
  const showMessage = (messageId) => {
    setViewer(null);
    closeContactPanel();
    onShowInChat?.(messageId);
  };
  const selectTabByKey = (event) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setActiveTab(tabs[nextIndex].id);
    panelRef.current?.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
  };

  if (!contactPanel.open || !target) return null;
  const viewerItem = viewer?.items[viewer.index];

  return <>
    <motion.aside ref={panelRef} role="dialog" aria-modal={isMobilePanel} aria-label={`${target.displayName || "Contact"} information`} initial={reduceMotion ? false : { x: "100%" }} animate={{ x: 0 }} exit={reduceMotion ? undefined : { x: "100%" }} transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }} className="fixed inset-0 z-[45] flex min-h-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--surface)] lg:static lg:h-full lg:w-[380px] lg:shrink-0">
      <header ref={stickyRef} className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-3">
        {contactPanel.history.length > 0 ? <button ref={closeRef} type="button" className="icon-btn focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={backContactPanel} aria-label="Back to group"><ArrowLeft size={19} /></button> : <button ref={closeRef} type="button" className="icon-btn focus-visible:ring-2 focus-visible:ring-indigo-500" onClick={closePanel} aria-label="Close contact information"><span className="lg:hidden"><ArrowLeft size={19} /></span><span className="hidden lg:inline"><X size={18} /></span></button>}
        <AnimatePresence>{showSticky && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-w-0 items-center gap-2"><Avatar src={target.photoURL} name={target.displayName} size={32} className="h-8 w-8 rounded-full" /><span className="truncate text-sm font-semibold text-[var(--text-primary)]">{target.displayName || "Contact"}</span></motion.div>}</AnimatePresence>
        <button type="button" onClick={closePanel} className="icon-btn ml-auto hidden focus-visible:ring-2 focus-visible:ring-indigo-500 lg:inline-flex" aria-label="Close contact information"><X size={17} /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
        <section ref={heroRef} className="px-5 pb-5 pt-6 text-center">
          <ContactAvatar user={target} onOpen={openAvatar} />
          <h2 className="break-words text-2xl font-bold text-[var(--text-primary)]">{target.displayName || "Contact"}</h2>
          {target.isGroup && <p className="mt-1 text-sm text-[var(--text-secondary)]">{target.members?.length || 0} members</p>}
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={() => { closePanel(); onFocusMessage?.(); }} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"><MessageCircle size={16} />Message</button>
          </div>
        </section>

        {!target.isGroup && <section className="mx-4 mb-4 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-2)]" aria-label="Contact information">
          {loadingDetails ? <div className="space-y-2 p-3"><SkeletonRows /></div> : <>
            {details?.bio && <InfoRow icon={Info} label="About" value={details.bio} onClick={() => copyValue(details.bio)} />}
            {details?.createdAt && dateValue(details.createdAt) && <InfoRow icon={CalendarDays} label="Joined" value={dateValue(details.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })} onClick={() => copyValue(dateValue(details.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }))} />}
            {!details?.bio && !details?.createdAt && <p className="px-4 py-4 text-sm text-[var(--text-muted)]">No additional information</p>}
          </>}
        </section>}
        {copied && <div role="status" className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[var(--surface-4)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] shadow-lg"><Check size={13} className="mr-1 inline" />Copied</div>}

        <div role="tablist" aria-label="Shared content" onKeyDown={selectTabByKey} className="sticky top-0 z-10 flex overflow-x-auto border-y border-[var(--border)] bg-[var(--surface-2)] px-2">
          {tabs.map((tab) => <button key={tab.id} type="button" role="tab" id={`contact-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls="contact-tabpanel" tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => setActiveTab(tab.id)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${activeTab === tab.id ? "border-indigo-500 text-[var(--primary-light)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>{tab.label}<span className="ml-1 text-[10px] opacity-75">{tab.count}</span></button>)}
        </div>

        <div id="contact-tabpanel" role="tabpanel" aria-labelledby={`contact-tab-${activeTab}`} className="p-4">
          {activeTab === "members" ? <div className="divide-y divide-[var(--border)]">{(target.members || []).map((member) => <button key={member.uid} type="button" onClick={() => openContactPanelUser(member)} className="flex w-full min-w-0 items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><Avatar src={member.photoURL} name={member.displayName} size={40} className="h-10 w-10 rounded-full" /><span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-primary)]">{member.displayName || "Member"}</span>{target.admin === member.uid && <span className="text-[10px] font-semibold text-[var(--primary-light)]">Admin</span>}</button>)}</div>
            : activeTab === "groups" ? <div className="divide-y divide-[var(--border)]">{commonGroups.map(({ chatId, group }) => <button key={chatId} type="button" onClick={() => { closePanel(); dispatch({ type: "SET_CHAT", payload: { user: group, chatId } }); navigate(`/chat/${chatId}`); }} className="flex w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><Avatar src={group.photoURL} name={group.displayName} size={40} className="h-10 w-10 rounded-xl" /><span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-primary)]">{group.displayName || "Group"}</span><Users size={16} className="text-[var(--text-muted)]" /></button>)}</div>
            : <SharedContent tab={activeTab} items={content[activeTab] || []} onMediaOpen={(index) => openViewer(activeTab === "gifs" ? content.gifs.map((item) => ({ ...item, src: item.message.img, original: item.message.img })) : content.mediaViewerItems, index)} onShowInChat={showMessage} />}
        </div>
      </div>
    </motion.aside>

    <AnimatePresence>
      {viewer && viewerItem && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Shared media viewer" onPointerDown={(event) => setViewer((current) => ({ ...current, startX: event.clientX }))} onPointerUp={(event) => { if (viewer.startX === null) return; const distance = event.clientX - viewer.startX; if (Math.abs(distance) > 50) setViewer((current) => ({ ...current, index: (current.index + (distance < 0 ? 1 : -1) + current.items.length) % current.items.length, startX: null })); else setViewer((current) => ({ ...current, startX: null })); }}>
        <div className="flex h-14 shrink-0 items-center gap-3 px-4"><button ref={viewerCloseRef} type="button" className="icon-btn text-white focus-visible:ring-2 focus-visible:ring-white" aria-label="Close viewer" onClick={() => setViewer(null)}><X size={20} /></button><span className="min-w-0 flex-1 truncate text-sm">{viewerItem.message.senderName || target.displayName} · {dateLabel(viewerItem.message.date)}</span><span className="text-xs tabular-nums">{viewer.index + 1} / {viewer.items.length}</span><a href={viewerItem.original} target="_blank" rel="noopener noreferrer" className="icon-btn text-white" aria-label="Open original media"><Download size={18} /></a><button type="button" onClick={() => showMessage(viewerItem.message.id)} className="rounded-full border border-white/30 px-3 py-2 text-xs font-semibold">Show in chat</button></div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-4"><button type="button" onClick={() => setViewer((current) => ({ ...current, index: (current.index - 1 + current.items.length) % current.items.length }))} className="absolute left-2 z-10 icon-btn text-white" aria-label="Previous media"><ChevronLeft size={26} /></button>{viewerItem.kind === "video" ? <video src={viewerItem.src} controls autoPlay className="max-h-full max-w-full" /> : <img src={viewerItem.src} alt="Shared media" className="max-h-full max-w-full object-contain" />}{viewerItem.kind !== "video" && viewer.items.length > 1 && <img src={viewer.items[(viewer.index + 1) % viewer.items.length].src} alt="" className="hidden" />}{viewer.items.length > 1 && <button type="button" onClick={() => setViewer((current) => ({ ...current, index: (current.index + 1) % current.items.length }))} className="absolute right-2 z-10 icon-btn text-white" aria-label="Next media"><ChevronRight size={26} /></button>}</div>
      </motion.div>}
    </AnimatePresence>
  </>;
});

const InfoRow = ({ icon: Icon, label, value, onClick }) => <button type="button" onClick={onClick} className="flex w-full items-start gap-3 border-b border-[var(--border)] px-4 py-3 text-left last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"><Icon size={17} className="mt-0.5 shrink-0 text-[var(--primary-light)]" /><span className="min-w-0"><span className="block text-[11px] text-[var(--text-muted)]">{label}</span><span className="block break-words text-sm text-[var(--text-primary)]">{value}</span></span></button>;

export default ContactPanel;