import React, { memo, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { deleteField, doc, FieldPath, getDoc, updateDoc } from "firebase/firestore";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Archive, ArchiveRestore, ArrowLeft, Bell, BellOff, CalendarDays, Check, ChevronDown,
  ChevronLeft, ChevronRight, Download, File, FileAudio, FileImage, FileVideo, Info,
  Link as LinkIcon, Mail, MessageCircle, MoreHorizontal, Play, Users, X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import { ChatContext, ContactPanelContext, UserChatsContext, UserDocumentContext } from "../context/ChatContext";
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

const ContactAvatar = memo(function ContactAvatar({ user, onOpen, online }) {
  const [loading, setLoading] = useState(Boolean(user.photoURL));
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setLoading(Boolean(user.photoURL));
    setFailed(false);
  }, [user.photoURL]);
  return <button type="button" onClick={onOpen} className="relative mx-auto mb-3 block h-[104px] w-[104px] rounded-full border-2 border-[var(--border-strong)] bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label="Open profile photo">
    {loading && <span className="absolute inset-0 animate-pulse rounded-full bg-[var(--surface-4)]" />}
    {!failed && user.photoURL ? <img src={optimizeUrl(user.photoURL, 800)} alt={user.displayName || "Profile photo"} className="relative h-full w-full rounded-full object-cover" loading="lazy" onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true); }} /> : <Avatar name={user.displayName} size={104} className="relative h-full w-full rounded-full" />}
    {online && <span className="avatar-dot-online absolute bottom-1 right-1" aria-label="Online" />}
  </button>;
});

const SkeletonRows = () => <div className="space-y-3" aria-label="Loading contact information">
  {[0, 1, 2].map((item) => <div key={item} className="h-12 animate-pulse rounded-lg bg-[var(--surface-3)]" />)}
</div>;

const MediaTile = memo(function MediaTile({ item, onOpen, moreCount = 0 }) {
  const isVideo = item.kind === "video";
  const src = item.message.img || item.message.file?.url;
  const optimized = optimizeUrl(src, 300);
  const thumb = isVideo && optimized ? optimized.replace("/upload/f_auto,q_auto,w_300/", "/upload/so_0,f_jpg,q_auto,w_300/") : optimized;
  const [failed, setFailed] = useState(false);
  return <button type="button" onClick={onOpen} className="group relative aspect-square min-w-0 overflow-hidden rounded-xl bg-[var(--surface-3)] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label={`Open ${isVideo ? "video" : item.kind === "gif" ? "GIF" : "image"}`}>
    {!failed && thumb ? <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" onError={() => setFailed(true)} /> : <span className="flex h-full items-center justify-center px-2 text-center text-xs text-[var(--text-muted)]">Image unavailable</span>}
    {isVideo && <span className="absolute inset-0 flex items-center justify-center bg-black/15 text-white"><Play size={23} fill="currentColor" /><span className="sr-only">Video</span>{durationLabel(item.message.file?.duration) && <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] tabular-nums">{durationLabel(item.message.file.duration)}</span>}</span>}
    {moreCount > 0 && <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-bold text-white">+{moreCount}</span>}
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
    return <a key={item.message.id || index} href={file.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
      <Icon size={19} className="shrink-0 text-[var(--primary-light)]" />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[var(--text-primary)]">{file.name || "Attachment"}</span><span className="text-xs text-[var(--text-muted)]">{bytesLabel(file.size)}{file.size ? " · " : ""}{dateLabel(item.message.date)}</span></span>
      <Download size={16} className="shrink-0 text-[var(--text-muted)]" />
    </a>;
  })}</div>;
  if (tab === "links") return <div className="divide-y divide-[var(--border)]">{items.map((item, index) => <a key={`${item.message.id}-${index}`} href={item.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-start gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
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

const StatCard = memo(function StatCard({ label, value }) {
  return <div className="glass min-w-0 rounded-[20px] px-3 py-3">
    <span className="block truncate text-[11px] text-[var(--text-2)]">{label}</span>
    <span className="mt-1 block text-[22px] font-bold leading-tight tabular-nums text-[var(--text-1)]">{value}</span>
  </div>;
});

const ContactPanel = memo(function ContactPanel({ onFocusMessage, onShowInChat }) {
  const context = useContext(ChatContext);
  const panelContext = useContext(ContactPanelContext);
  const userChats = useContext(UserChatsContext);
  const userDocument = useContext(UserDocumentContext);
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const { data, dispatch } = context;
  const { contactPanel, closeContactPanel, openContactPanelUser, backContactPanel } = panelContext;
  const target = contactPanel.user;
  const messages = useLoadedMessages(data.chatId);
  const reduceMotion = useReducedMotion();
  const [details, setDetails] = useState(() => target?.uid ? userCache.get(target.uid)?.data || null : null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState("media");
  const [showMediaScreen, setShowMediaScreen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMuteOptions, setShowMuteOptions] = useState(false);
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
    setShowMediaScreen(false);
    setShowMoreMenu(false);
  }, [target?.uid]);

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
        else if (showMoreMenu) setShowMoreMenu(false);
        else if (showMediaScreen) setShowMediaScreen(false);
        else if (contactPanel.history.length > 0) backContactPanel();
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
  }, [contactPanel.open, contactPanel.history.length, target?.uid, closeContactPanel, backContactPanel, showMediaScreen, showMoreMenu]);

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
  const preferences = userDocument.chatPrefs?.[data.chatId] || {};
  const isMuted = preferences.mutedUntil > Date.now();
  const isArchived = Boolean(preferences.archived);
  const isCurrentConversation = target.uid === data.user?.uid;
  const online = target.online === true || target.presence === "online" || details?.online === true || details?.presence === "online";
  const lastSeen = dateValue(target.lastSeen || details?.lastSeen);
  const subtitle = target.isGroup
    ? (target.members || []).map((member) => member.displayName).filter(Boolean).join(", ") || `${target.members?.length || 0} members`
    : target.email || details?.email || (online ? "Online" : lastSeen ? `Last seen ${lastSeen.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : target.status || details?.bio || "");
  const infoItems = [
    details?.bio && { icon: Info, label: "About", value: details.bio },
    (target.email || details?.email) && { icon: Mail, label: "Email", value: target.email || details.email },
    details?.createdAt && dateValue(details.createdAt) && {
      icon: CalendarDays,
      label: "Joined",
      value: dateValue(details.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    },
  ].filter(Boolean);
  const stats = [
    { label: "Loaded messages", value: messages.length },
    content.media.length > 0 && { label: "Media", value: content.media.length },
    target.isGroup
      ? target.members?.length > 0 && { label: "Members", value: target.members.length }
      : target.uid && { label: "Groups", value: commonGroups.length },
  ].filter(Boolean);
  const saveChatPreference = async (key, value) => {
    if (!currentUser?.uid || !data.chatId) return;
    try {
      await updateDoc(doc(db, "users", currentUser.uid), new FieldPath("chatPrefs", data.chatId, key), value);
    } catch (error) {
      console.error("Error saving chat preference:", error);
    }
  };
  const updateMute = async (duration) => {
    if (!currentUser?.uid || !data.chatId) return;
    const value = duration === "off" ? deleteField() : duration === "always" ? 9999999999999 : Date.now() + duration;
    try {
      await updateDoc(doc(db, "users", currentUser.uid), new FieldPath("chatPrefs", data.chatId, "mutedUntil"), value);
      setShowMuteOptions(false);
      setShowMoreMenu(false);
    } catch (error) {
      console.error("Error saving mute preference:", error);
    }
  };
  const openContactMedia = (index) => openViewer(content.mediaViewerItems, index);
  const showSharedContent = () => {
    setActiveTab(content.media.length ? "media" : tabs.find((tab) => tab.count > 0)?.id || "media");
    setShowMediaScreen(true);
  };
  const viewerItem = viewer?.items[viewer.index];

  return <>
    <motion.aside ref={panelRef} role="dialog" aria-modal={isMobilePanel} aria-label={`${target.displayName || "Contact"} information`} initial={reduceMotion ? false : { x: "100%" }} animate={{ x: 0 }} exit={reduceMotion ? undefined : { x: "100%" }} transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }} className="ember-bg fixed inset-0 z-[45] flex min-h-0 flex-col overflow-hidden border-l border-[var(--border)] bg-[var(--bg)] lg:static lg:h-full lg:w-[380px] lg:shrink-0">
      <header ref={stickyRef} className="relative z-20 flex min-h-14 shrink-0 items-center gap-2 px-3 pt-[env(safe-area-inset-top)]">
        <button ref={closeRef} type="button" className="icon-btn-glass" onClick={() => {
          if (showMediaScreen) setShowMediaScreen(false);
          else if (contactPanel.history.length > 0) backContactPanel();
          else closePanel();
        }} aria-label={showMediaScreen ? "Back to contact information" : contactPanel.history.length > 0 ? "Back to group" : "Close contact information"}>
          <ArrowLeft size={19} />
        </button>
        {showMediaScreen ? <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-[var(--text-1)]">Media and photos</h2> : <AnimatePresence>{showSticky && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-w-0 flex-1 items-center gap-2"><Avatar src={target.photoURL} name={target.displayName} size={32} className="h-8 w-8 rounded-full" /><span className="truncate text-sm font-semibold text-[var(--text-1)]">{target.displayName || "Contact"}</span></motion.div>}</AnimatePresence>}
        {!showMediaScreen && isCurrentConversation && <div className="relative ml-auto">
          <button type="button" onClick={() => setShowMoreMenu((open) => !open)} className="icon-btn-glass" aria-label="Chat options" aria-expanded={showMoreMenu}><MoreHorizontal size={20} /></button>
          {showMoreMenu && <div role="menu" className="glass absolute right-0 top-12 z-30 w-56 overflow-hidden p-1 shadow-xl">
            <button type="button" role="menuitem" onClick={() => { setShowMuteOptions((open) => !open); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-1)] hover:bg-[var(--hover)]">
              {isMuted ? <BellOff size={17} /> : <Bell size={17} />}{isMuted ? "Unmute notifications" : "Mute notifications"}<ChevronDown size={14} className="ml-auto" />
            </button>
            {showMuteOptions && <div className="space-y-0.5 border-y border-[var(--border)] py-1">
              {isMuted && <button type="button" onClick={() => updateMute("off")} className="menu-row w-full">Turn off mute</button>}
              <button type="button" onClick={() => updateMute(8 * 60 * 60 * 1000)} className="menu-row w-full">For 8 hours</button>
              <button type="button" onClick={() => updateMute(7 * 24 * 60 * 60 * 1000)} className="menu-row w-full">For 1 week</button>
              <button type="button" onClick={() => updateMute("always")} className="menu-row w-full">Always</button>
            </div>}
            <button type="button" role="menuitem" onClick={async () => { await saveChatPreference("archived", !isArchived); setShowMoreMenu(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text-1)] hover:bg-[var(--hover)]">
              {isArchived ? <ArchiveRestore size={17} /> : <Archive size={17} />}{isArchived ? "Unarchive chat" : "Archive chat"}
            </button>
          </div>}
        </div>}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
        {!showMediaScreen ? <>
          <section ref={heroRef} className="px-5 pb-5 pt-5 text-center">
            <ContactAvatar user={target} onOpen={openAvatar} online={online} />
            <h2 className="break-words text-[22px] font-bold leading-tight text-[var(--text-1)]">{target.displayName || "Contact"}</h2>
            {subtitle && <p className="mt-1 truncate text-sm text-[var(--text-2)]">{subtitle}</p>}
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={() => { closePanel(); onFocusMessage?.(); }} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--on-primary)] transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><MessageCircle size={16} />Message</button>
            </div>
          </section>

          <section className={`mx-4 mb-4 grid gap-2 ${stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : "grid-cols-3"}`} aria-label="Conversation statistics">
            {stats.map((stat) => <StatCard key={stat.label} label={stat.label} value={stat.value} />)}
          </section>

          {content.media.length > 0 ? <section className="glass mx-4 mb-4 rounded-[20px] p-3">
            <button type="button" onClick={showSharedContent} className="mb-3 flex w-full items-center justify-between rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
              <span className="text-sm font-semibold text-[var(--text-1)]">Media and photos</span><ChevronRight size={18} className="text-[var(--text-2)]" />
            </button>
            <div className="grid grid-cols-4 gap-1.5">
              {content.media.slice(0, 4).map((item, index) => <MediaTile key={item.message.id || `${item.kind}-${index}`} item={item} onOpen={() => openContactMedia(index)} moreCount={index === 3 ? content.media.length - 4 : 0} />)}
            </div>
          </section> : tabs.some((tab) => tab.count > 0) && <button type="button" onClick={showSharedContent} className="glass mx-4 mb-4 flex w-[calc(100%-2rem)] items-center justify-between rounded-[20px] p-4 text-left">
            <span><span className="block text-sm font-semibold text-[var(--text-1)]">Shared content</span><span className="mt-1 block text-xs text-[var(--text-2)]">Browse files, links, voice, GIFs, and groups</span></span><ChevronRight size={18} className="shrink-0 text-[var(--text-2)]" />
          </button>}

          {infoItems.length > 0 && <section className="glass mx-4 mb-4 overflow-hidden rounded-[20px]" aria-label="Contact information">
            {infoItems.map((item) => <InfoRow key={item.label} {...item} onClick={() => copyValue(item.value)} />)}
          </section>}
          {loadingDetails && !target.isGroup && <section className="glass mx-4 mb-4 rounded-[20px] p-3"><SkeletonRows /></section>}

          {isCurrentConversation && <section className="glass mx-4 mb-5 overflow-hidden rounded-[20px]" aria-label="Chat settings">
            <button type="button" onClick={() => setShowMuteOptions((open) => !open)} className="contact-setting-row">
              {isMuted ? <BellOff size={20} /> : <Bell size={20} />}<span className="flex-1">{isMuted ? "Notifications muted" : "Notifications"}</span><ChevronDown size={17} className={`transition-transform ${showMuteOptions ? "rotate-180" : ""}`} />
            </button>
            {showMuteOptions && <div className="border-b border-[var(--border)] px-3 py-2">
              {isMuted && <button type="button" onClick={() => updateMute("off")} className="menu-row w-full">Turn off mute</button>}
              <button type="button" onClick={() => updateMute(8 * 60 * 60 * 1000)} className="menu-row w-full">Mute for 8 hours</button>
              <button type="button" onClick={() => updateMute(7 * 24 * 60 * 60 * 1000)} className="menu-row w-full">Mute for 1 week</button>
              <button type="button" onClick={() => updateMute("always")} className="menu-row w-full">Mute always</button>
            </div>}
            <button type="button" onClick={() => saveChatPreference("archived", !isArchived)} className="contact-setting-row last:border-0">
              {isArchived ? <ArchiveRestore size={20} /> : <Archive size={20} />}<span className="flex-1">{isArchived ? "Unarchive chat" : "Archive chat"}</span>
            </button>
          </section>}
        </> : <>
          <div role="tablist" aria-label="Shared content" onKeyDown={selectTabByKey} className="sticky top-0 z-10 flex overflow-x-auto border-b border-[var(--border)] bg-[var(--glass-bg)] px-2 backdrop-blur-lg">
            {tabs.map((tab) => <button key={tab.id} type="button" role="tab" id={`contact-tab-${tab.id}`} aria-selected={activeTab === tab.id} aria-controls="contact-tabpanel" tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => setActiveTab(tab.id)} className={`shrink-0 border-b-2 px-3 py-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)] ${activeTab === tab.id ? "border-[var(--primary)] text-[var(--primary)]" : "border-transparent text-[var(--text-2)] hover:text-[var(--text-1)]"}`}>{tab.label}<span className="ml-1 text-[10px] opacity-75">{tab.count}</span></button>)}
          </div>
          <div id="contact-tabpanel" role="tabpanel" aria-labelledby={`contact-tab-${activeTab}`} className="p-4">
            {activeTab === "members" ? <div className="glass divide-y divide-[var(--border)] rounded-[20px] px-3">{(target.members || []).map((member) => <button key={member.uid} type="button" onClick={() => openContactPanelUser(member)} className="flex w-full min-w-0 items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><Avatar src={member.photoURL} name={member.displayName} size={40} className="h-10 w-10 rounded-full" /><span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-1)]">{member.displayName || "Member"}</span>{target.admin === member.uid && <span className="text-[10px] font-semibold text-[var(--primary)]">Admin</span>}</button>)}</div>
              : activeTab === "groups" ? <div className="glass divide-y divide-[var(--border)] rounded-[20px] px-3">{commonGroups.map(({ chatId, group }) => <button key={chatId} type="button" onClick={() => { closePanel(); dispatch({ type: "SET_CHAT", payload: { user: group, chatId } }); navigate(`/chat/${chatId}`); }} className="flex w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"><Avatar src={group.photoURL} name={group.displayName} size={40} className="h-10 w-10 rounded-xl" /><span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-1)]">{group.displayName || "Group"}</span><Users size={16} className="text-[var(--text-2)]" /></button>)}</div>
                : <SharedContent tab={activeTab} items={content[activeTab] || []} onMediaOpen={(index) => openViewer(activeTab === "gifs" ? content.gifs.map((item) => ({ ...item, src: item.message.img, original: item.message.img })) : content.mediaViewerItems, index)} onShowInChat={showMessage} />}
          </div>
        </>}
      </div>
      {copied && <div role="status" className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[var(--surface-3)] px-3 py-2 text-xs font-medium text-[var(--text-1)] shadow-lg"><Check size={13} className="mr-1 inline" />Copied</div>}
    </motion.aside>

    <AnimatePresence>
      {viewer && viewerItem && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="Shared media viewer" onPointerDown={(event) => setViewer((current) => ({ ...current, startX: event.clientX }))} onPointerUp={(event) => { if (viewer.startX === null) return; const distance = event.clientX - viewer.startX; if (Math.abs(distance) > 50) setViewer((current) => ({ ...current, index: (current.index + (distance < 0 ? 1 : -1) + current.items.length) % current.items.length, startX: null })); else setViewer((current) => ({ ...current, startX: null })); }}>
        <div className="flex h-14 shrink-0 items-center gap-3 px-4"><button ref={viewerCloseRef} type="button" className="icon-btn text-white focus-visible:ring-2 focus-visible:ring-white" aria-label="Close viewer" onClick={() => setViewer(null)}><X size={20} /></button><span className="min-w-0 flex-1 truncate text-sm">{viewerItem.message.senderName || target.displayName} · {dateLabel(viewerItem.message.date)}</span><span className="text-xs tabular-nums">{viewer.index + 1} / {viewer.items.length}</span><a href={viewerItem.original} target="_blank" rel="noopener noreferrer" className="icon-btn text-white" aria-label="Open original media"><Download size={18} /></a><button type="button" onClick={() => showMessage(viewerItem.message.id)} className="rounded-full border border-white/30 px-3 py-2 text-xs font-semibold">Show in chat</button></div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-4"><button type="button" onClick={() => setViewer((current) => ({ ...current, index: (current.index - 1 + current.items.length) % current.items.length }))} className="absolute left-2 z-10 icon-btn text-white" aria-label="Previous media"><ChevronLeft size={26} /></button>{viewerItem.kind === "video" ? <video src={viewerItem.src} controls autoPlay className="max-h-full max-w-full" /> : <img src={viewerItem.src} alt="Shared media" className="max-h-full max-w-full object-contain" />}{viewerItem.kind !== "video" && viewer.items.length > 1 && <img src={viewer.items[(viewer.index + 1) % viewer.items.length].src} alt="" className="hidden" />}{viewer.items.length > 1 && <button type="button" onClick={() => setViewer((current) => ({ ...current, index: (current.index + 1) % current.items.length }))} className="absolute right-2 z-10 icon-btn text-white" aria-label="Next media"><ChevronRight size={26} /></button>}</div>
      </motion.div>}
    </AnimatePresence>
  </>;
});

const InfoRow = ({ icon: Icon, label, value, onClick }) => <button type="button" onClick={onClick} className="flex w-full items-start gap-3 border-b border-[color-mix(in_srgb,var(--border)_65%,transparent)] px-4 py-3 text-left last:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--ring)]"><Icon size={20} className="mt-0.5 shrink-0 text-[var(--text-2)]" /><span className="min-w-0"><span className="block text-[11px] text-[var(--text-2)]">{label}</span><span className="block break-words text-sm text-[var(--text-1)]">{value}</span></span></button>;

export default ContactPanel;