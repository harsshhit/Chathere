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
        <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-6 border border-indigo-500/20">
          <MessageSquareOff size={36} />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-2">404</h1>
        <h2 className="text-lg font-semibold text-gray-200 mb-2">Page Not Found</h2>
        <p className="text-xs text-gray-400 mb-6 leading-relaxed">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-200 shadow-lg shadow-indigo-600/30"
        >
          <Home size={16} />
          Back to ChatHere Home
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
