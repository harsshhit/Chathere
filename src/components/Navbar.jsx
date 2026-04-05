import React, { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "./Avatar";
import { Users } from "lucide-react";
import CreateGroup from "./CreateGroup";
import logo from "./logo.png";

const Navbar = () => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showGroupModal, setShowGroupModal] = useState(false);

  return (
    <>
      <div
        className="px-4 py-3 flex items-center justify-between"
      style={{
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Brand */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => navigate("/")}
        className="flex-shrink-0 flex items-center justify-center outline-none rounded-xl hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-indigo-500/50 transition-all duration-300 px-2 py-1 -ml-2 cursor-pointer"
        title="Home"
      >
        <img 
          src={logo} 
          alt="logo" 
          className="h-8 sm:h-9 md:h-10 w-auto object-contain drop-shadow-md" 
        />
      </motion.button>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        {/* Create group button */}
        <button
          onClick={() => setShowGroupModal(true)}
          className="icon-btn flex-shrink-0"
          title="New Group"
        >
          <Users size={18} />
        </button>

        {/* User info */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/profile")}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all duration-200"
          style={{ background: "rgba(255,255,255,0.03)" }}
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
