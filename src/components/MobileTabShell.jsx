import React, { Suspense, lazy, useContext, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { MessageCircle, Plus, Settings as SettingsIcon, UserRound } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { UserChatsContext, UserDocumentContext } from "../context/ChatContext";
import Avatar from "./Avatar";

const Home = lazy(() => import("../pages/Home"));
const Profile = lazy(() => import("../pages/Profile"));
const Settings = lazy(() => import("../pages/Settings"));
const Chat = lazy(() => import("./Chat"));
const LoginPage = lazy(() => import("../pages/Login"));
const RegisterPage = lazy(() => import("../pages/Register"));
const NotFoundPage = lazy(() => import("../pages/NotFound"));

const tabList = [
  { id: "chats", label: "Chats", path: "/", icon: MessageCircle },
  { id: "settings", label: "Settings", path: "/settings", icon: SettingsIcon },
  { id: "profile", label: "Profile", path: "/profile", icon: UserRound },
];

const TabFallback = () => <div className="tab-scroll-padding p-4" aria-label="Loading screen">
  <div className="mb-4 h-9 w-40 animate-pulse rounded-xl bg-[var(--surface-3)]" />
  <div className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-14 animate-pulse rounded-2xl bg-[var(--surface-2)]" />)}</div>
</div>;

function activeTab(pathname) {
  if (pathname === "/" || pathname.startsWith("/chat/")) return "chats";
  if (pathname === "/settings" || pathname.startsWith("/settings/")) return "settings";
  if (pathname === "/profile" || pathname.startsWith("/profile/")) return "profile";
  return null;
}

export default function MobileTabShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { currentUser, loading } = useContext(AuthContext);
  const userChats = useContext(UserChatsContext);
  const userDocument = useContext(UserDocumentContext);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [visited, setVisited] = useState(() => {
    const initial = activeTab(window.location.pathname);
    return new Set(initial ? [initial] : ["chats"]);
  });

  const currentTab = activeTab(location.pathname);
  const isChat = location.pathname.startsWith("/chat/");
  const isKnownTabRoute = location.pathname === "/" || location.pathname === "/settings" || location.pathname === "/profile";
  const navVisible = isMobile && isKnownTabRoute && !keyboardOpen && !modalOpen;
  const unreadTotal = useMemo(() => Object.entries(userChats || {}).reduce((total, [chatId, chat]) => {
    const prefs = userDocument.chatPrefs?.[chatId] || {};
    if (prefs.archived || prefs.mutedUntil > clock) return total;
    return total + Math.max(0, Number(chat?.unread) || 0);
  }, 0), [clock, userChats, userDocument.chatPrefs]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const checkKeyboard = () => {
      const focused = document.activeElement;
      const editable = focused instanceof HTMLElement && (focused.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(focused.tagName));
      const shrunk = window.innerWidth < 768 && window.visualViewport && window.innerHeight - window.visualViewport.height > 120;
      setKeyboardOpen(Boolean(editable || shrunk));
    };
    const onFocus = () => window.setTimeout(checkKeyboard, 80);
    checkKeyboard();
    window.visualViewport?.addEventListener("resize", checkKeyboard);
    window.addEventListener("resize", checkKeyboard);
    window.addEventListener("focusin", onFocus);
    window.addEventListener("focusout", onFocus);
    return () => {
      window.visualViewport?.removeEventListener("resize", checkKeyboard);
      window.removeEventListener("resize", checkKeyboard);
      window.removeEventListener("focusin", onFocus);
      window.removeEventListener("focusout", onFocus);
    };
  }, []);

  useEffect(() => {
    const setModal = (event) => setModalOpen(Boolean(event.detail?.open));
    window.addEventListener("chathere:mobile-overlay", setModal);
    return () => window.removeEventListener("chathere:mobile-overlay", setModal);
  }, []);

  useEffect(() => {
    if (currentTab) setVisited((old) => old.has(currentTab) ? old : new Set([...old, currentTab]));
  }, [currentTab]);

  useEffect(() => {
    if (!isMobile || !isKnownTabRoute) return;
    let idleId;
    let timeoutId;
    const preload = () => {
      import("../pages/Profile").catch((error) => console.error("Could not preload Profile:", error));
      import("../pages/Settings").catch((error) => console.error("Could not preload Settings:", error));
    };
    if ("requestIdleCallback" in window) idleId = window.requestIdleCallback(preload);
    else timeoutId = window.setTimeout(preload, 800);
    return () => {
      if (idleId && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [isMobile, isKnownTabRoute]);

  const navigateTab = (tab) => {
    if (currentTab === tab.id) {
      const activeScreen = document.querySelector(".mobile-tab-screen:not([hidden])");
      const mainScroll = activeScreen?.querySelector("[data-main-scroll]");
      (mainScroll || activeScreen)?.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }
    const tabSwitchState = { mobileTabSwitch: true };
    if (tab.id === "chats") {
      if (location.state?.mobileTabSwitch && window.history.state?.idx > 0) navigate(-1);
      else navigate("/", { replace: true, state: tabSwitchState });
    } else {
      navigate(tab.path, { replace: currentTab !== "chats", state: tabSwitchState });
    }
  };

  const openNewGroup = () => window.dispatchEvent(new Event("chathere:open-create-group"));
  const tabComponents = {
    chats: <Home mobileRootOnly />,
    settings: <Settings />,
    profile: <Profile />,
  };

  if (loading) return <TabFallback />;
  const requiresAuth = location.pathname === "/" || isChat || location.pathname.startsWith("/profile") || location.pathname.startsWith("/settings");
  if (!currentUser && requiresAuth) return <Navigate to="/login" replace />;
  if (!isMobile) return <DesktopRoutes />;
  if (!currentTab && !isChat) return <DesktopRoutes />;

  return <div className="mobile-tab-shell" style={{ "--nav-h": "calc(72px + env(safe-area-inset-bottom, 0px))" }}>
    {tabList.map((tab) => {
      const active = currentTab === tab.id;
      return visited.has(tab.id) && <section
        key={tab.id}
        className={`mobile-tab-screen ${active ? "is-active" : ""} ember-bg`}
        data-tab={tab.id}
        hidden={!active}
        aria-hidden={!active}
      >
        <Suspense fallback={<TabFallback />}>{tabComponents[tab.id]}</Suspense>
      </section>;
    })}
    <AnimatePresence>
      {isChat && <motion.div
        key={location.pathname}
        className="absolute inset-0 z-50 overflow-hidden"
        initial={reduceMotion ? false : { x: "100%" }}
        animate={{ x: 0 }}
        exit={reduceMotion ? undefined : { x: "100%" }}
        transition={{ duration: reduceMotion ? 0 : .24, ease: "easeOut" }}
      ><Suspense fallback={<TabFallback />}><Chat /></Suspense></motion.div>}
    </AnimatePresence>
    <AnimatePresence>
      {navVisible && <motion.div
        className="mobile-nav-shell"
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: 16 }}
        transition={{ duration: reduceMotion ? 0 : .2 }}
      >
        <nav className="mobile-nav-pill glass" role="tablist" aria-label="Main navigation">
          {tabList.map((tab) => {
            const active = currentTab === tab.id;
            const Icon = tab.icon;
            return <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={tab.label}
              onClick={() => navigateTab(tab)}
              className={`mobile-nav-tab ${active ? "is-active" : ""}`}
            >
              {tab.id === "profile"
                ? <span className="mobile-nav-avatar">{currentUser?.uid
                  ? <Avatar src={currentUser.photoURL} name={currentUser.displayName || currentUser.email || "Profile"} size={26} className="h-full w-full rounded-full" />
                  : <span className="h-full w-full animate-pulse rounded-full bg-[var(--surface-3)]" />}</span>
                : <Icon size={22} strokeWidth={active ? 2.2 : 1.75} fill={active && tab.id === "chats" ? "currentColor" : "none"} />}
              <span>{tab.label}</span>
              {tab.id === "chats" && unreadTotal > 0 && <span className="badge-unread mobile-nav-badge">{unreadTotal > 99 ? "99+" : unreadTotal}</span>}
            </button>;
          })}
        </nav>
        <AnimatePresence>
          {currentTab === "chats" && <motion.button
            type="button"
            whileTap={{ scale: .96 }}
            onClick={openNewGroup}
            className="fab tab-fab inline-flex items-center justify-center"
            aria-label="Create a new group"
            initial={reduceMotion ? false : { opacity: 0, scale: .8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: .8 }}
            transition={{ duration: reduceMotion ? 0 : .16 }}
          ><Plus size={22} /></motion.button>}
        </AnimatePresence>
      </motion.div>}
    </AnimatePresence>
  </div>;
}

function DesktopRoutes() {
  const { currentUser, loading } = useContext(AuthContext);
  if (loading) return <TabFallback />;
  return <Suspense fallback={<TabFallback />}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    {currentUser ? <>
      <Route path="/" element={<Home />}><Route path="chat/:chatId" element={null} /></Route>
      <Route path="/profile" element={<Profile />}><Route path="edit" element={null} /></Route>
      <Route path="/settings" element={<Settings />}><Route path="notifications" element={null} /></Route>
      <Route path="*" element={<NotFoundPage />} />
    </> : <Route path="*" element={<Navigate to="/login" replace />} />}
  </Routes></Suspense>;
}
