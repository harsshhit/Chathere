import React from "react";
import { Link } from "react-router-dom";
import { MessageSquareOff, Home } from "lucide-react";
import { motion } from "framer-motion";

const NotFound = () => {
  return (
    <div className="auth-bg min-h-[100dvh] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="glass-card p-8 max-w-md w-full text-center"
      >
        <div className="w-20 h-20 rounded-3xl bg-[var(--primary-soft)] text-[var(--primary-text)] flex items-center justify-center mx-auto mb-6 border border-[var(--primary-border)]">
          <MessageSquareOff size={36} />
        </div>
        <h1 className="text-3xl font-extrabold text-[var(--text-primary)] mb-2">404</h1>
        <h2 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">Page Not Found</h2>
        <p className="text-xs text-[var(--text-muted)] mb-6 leading-relaxed">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-[var(--on-primary)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-all duration-200 shadow-[0_8px_24px_var(--primary-glow)]"
        >
          <Home size={16} />
          Back to ChatHere Home
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
