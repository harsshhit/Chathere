import React, { useContext, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, MoreHorizontal, Search, Settings, Star, Sun, Moon, UserRound, Users } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const Navbar = ({ onSearch, searchOpen, onOpenGroup }) => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const isDark = theme === "dark";

  const openArchived = () => {
    setShowMenu(false);
    if (location.pathname !== "/") navigate("/");
    window.setTimeout(() => window.dispatchEvent(new Event("chathere:show-archived")), 0);
  };

  const openStarred = () => {
    setShowMenu(false);
    window.alert("Starred messages will be available with Phase A.");
  };

  return (
    <header className="safe-top flex items-center justify-between gap-3 px-4 pb-3 pt-4">
      <h1 className="text-[30px] font-bold leading-tight tracking-[-0.04em] text-[var(--text-primary)]">
        Chats
      </h1>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSearch}
          className="icon-btn-glass"
          title="Search people"
          aria-label="Search people"
          aria-expanded={searchOpen}
          aria-controls="sidebar-search"
        >
          <Search size={18} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onOpenGroup}
          className="icon-btn-glass"
          title="New group"
          aria-label="New group"
        >
          <Users size={18} strokeWidth={1.75} />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu((open) => !open)}
            className="icon-btn-glass"
            title="More options"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={showMenu}
          >
            <MoreHorizontal size={19} strokeWidth={1.75} />
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div
                role="menu"
                aria-label="Chat list options"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="glass-card absolute right-0 top-full z-40 mt-2 w-52 p-1.5"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowMenu(false); navigate("/profile"); }}
                  className="menu-row"
                >
                  <UserRound size={16} /> Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowMenu(false); navigate("/settings"); }}
                  className="menu-row"
                >
                  <Settings size={16} /> Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowMenu(false); toggleTheme(); }}
                  className="menu-row"
                >
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  Switch to {isDark ? "light" : "dark"} theme
                </button>
                <button type="button" role="menuitem" onClick={openArchived} className="menu-row">
                  <Archive size={16} /> Archived chats
                </button>
                <button type="button" role="menuitem" onClick={openStarred} className="menu-row">
                  <Star size={16} /> Starred messages
                </button>
                <div className="mt-1 border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
                  {currentUser?.displayName || currentUser?.email}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <style>{`.menu-row{display:flex;align-items:center;gap:.65rem;width:100%;padding:.6rem .7rem;border-radius:.65rem;text-align:left;font-size:.84rem;color:var(--text-primary)}.menu-row:hover,.menu-row:focus-visible{background:var(--hover);outline:none}`}</style>
    </header>
  );
};

export default Navbar;
