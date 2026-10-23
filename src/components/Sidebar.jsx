import React, { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import Navbar from "./Navbar";
import Search from "./Search";
import Chats from "./Chats";
import NotificationBanner from "./NotificationBanner";
import InstallBanner from "./InstallBanner";
import CreateGroup from "./CreateGroup";

const Sidebar = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);

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
      <div className="flex-shrink-0">
        <InstallBanner />
        <NotificationBanner />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Chats />
      </div>

      <AnimatePresence>
        {showGroupModal && <CreateGroup onClose={() => {
          setShowGroupModal(false);
          window.dispatchEvent(new CustomEvent("chathere:mobile-overlay", { detail: { open: false } }));
        }} />}
      </AnimatePresence>
    </div>
  );
};

export default Sidebar;
