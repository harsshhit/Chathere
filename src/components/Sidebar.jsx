import React, { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Search from "./Search";
import Chats from "./Chats";
import NotificationBanner from "./NotificationBanner";
import InstallBanner from "./InstallBanner";

const CreateGroup = lazy(() => import("./CreateGroup"));

const Sidebar = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [notificationPromptVisible, setNotificationPromptVisible] = useState(true);
  const location = useLocation();
  const showPrompts = location.pathname === "/" || location.pathname.startsWith("/chat/");

  useEffect(() => {
    const openGroup = () => {
      setShowGroupModal(true);
      window.dispatchEvent(new CustomEvent("chathere:mobile-overlay", { detail: { open: true } }));
    };
    window.addEventListener("chathere:open-create-group", openGroup);
    return () => window.removeEventListener("chathere:open-create-group", openGroup);
  }, []);

  const handleSearch = () => {
    setSearchOpen((open) => window.innerWidth >= 768 || !open);
  };

  return (
    <div className="relative flex h-full flex-col overflow-hidden ember-bg">
      <Navbar
        onSearch={handleSearch}
        searchOpen={searchOpen}
        onOpenGroup={() => window.dispatchEvent(new Event("chathere:open-create-group"))}
      />
      <div
        id="sidebar-search"
        className={`sidebar-search ${searchOpen ? "is-open" : ""}`}
      >
        <Search isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
      {showPrompts && <div className="flex-shrink-0">
        <NotificationBanner onVisibilityChange={setNotificationPromptVisible} />
        {!notificationPromptVisible && <InstallBanner />}
      </div>}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Chats />
      </div>

      <AnimatePresence>
        {showGroupModal && <Suspense fallback={<div className="fixed inset-0 z-[80] bg-black/40 p-4" aria-label="Loading group creation"><div className="glass-card mx-auto mt-[20vh] h-64 max-w-md animate-pulse rounded-3xl" /></div>}><CreateGroup onClose={() => {
          setShowGroupModal(false);
          window.dispatchEvent(new CustomEvent("chathere:mobile-overlay", { detail: { open: false } }));
        }} /></Suspense>}
      </AnimatePresence>
    </div>
  );
};

export default Sidebar;
