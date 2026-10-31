import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, Search, Settings, Sun, Moon, UserRound, Users } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const Navbar = ({ onSearch, searchOpen, onOpenGroup }) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [showMenu, setShowMenu] = useState(false);
  const isDark = theme === "dark";

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
          onPointerEnter={() => import("./CreateGroup").catch((error) => console.error("Could not preload group creation:", error))}
          onFocus={() => import("./CreateGroup").catch((error) => console.error("Could not preload group creation:", error))}
          onTouchStart={() => import("./CreateGroup").catch((error) => console.error("Could not preload group creation:", error))}
          className="icon-btn-glass hidden md:inline-flex"
          title="New group"
          aria-label="New group"
        >
          <Users size={18} strokeWidth={1.75} />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          className="icon-btn-glass hidden md:inline-flex"
          title={`Switch to ${isDark ? "light" : "dark"} theme`}
          aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="relative hidden md:block">
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
                aria-label="Account navigation"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.14 }}
                className="glass-card absolute right-0 top-full z-40 mt-2 w-52 p-1.5"
              >
                <button
                  type="button"
                  role="menuitem"
                  onPointerEnter={() => import("../pages/Profile").catch((error) => console.error("Could not preload Profile:", error))}
                  onFocus={() => import("../pages/Profile").catch((error) => console.error("Could not preload Profile:", error))}
                  onClick={() => { setShowMenu(false); navigate("/profile"); }}
                  className="menu-row"
                >
                  <UserRound size={16} /> Profile
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onPointerEnter={() => import("../pages/Settings").catch((error) => console.error("Could not preload Settings:", error))}
                  onFocus={() => import("../pages/Settings").catch((error) => console.error("Could not preload Settings:", error))}
                  onClick={() => { setShowMenu(false); navigate("/settings"); }}
                  className="menu-row"
                >
                  <Settings size={16} /> Settings
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
