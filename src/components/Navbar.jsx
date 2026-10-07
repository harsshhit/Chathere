import React, { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "./Avatar";
import { Users, Sun, Moon } from "lucide-react";
import CreateGroup from "./CreateGroup";
import { useTheme } from "../context/ThemeContext";

const Navbar = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showGroupModal, setShowGroupModal] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/")}
          className="flex-shrink-0 flex items-center outline-none rounded-xl hover:bg-[var(--hover)] transition-all duration-300 px-2 py-1 -ml-2 cursor-pointer"
          title="ChatHere"
        >
          <span className="brand-logo text-xl sm:text-2xl">ChatHere</span>
        </motion.button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="icon-btn flex-shrink-0"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.2 }}
                className="flex"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </motion.span>
            </AnimatePresence>
          </button>

          <button
            onClick={() => setShowGroupModal(true)}
            className="icon-btn flex-shrink-0"
            title="New Group"
            aria-label="New Group"
          >
            <Users size={18} />
          </button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onPointerDown={() => {
              import("../pages/Profile").catch(() => {});
            }}
            onClick={() => navigate("/profile")}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all duration-200"
            style={{ background: "var(--subtle)", touchAction: "manipulation" }}
            title="View profile"
          >
            <span
              className="text-sm font-medium max-w-[100px] truncate hidden sm:block"
              style={{ color: "var(--text-secondary)" }}
            >
              {currentUser?.displayName}
            </span>
            <Avatar
              src={currentUser?.photoURL}
              alt={currentUser?.displayName}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              style={{
                border: "2px solid rgba(99,102,241,0.5)",
                boxShadow: "0 2px 12px rgba(99,102,241,0.25)",
              }}
            />
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {showGroupModal && <CreateGroup onClose={() => setShowGroupModal(false)} />}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
