import React, { useState, useEffect } from "react";
import { Download, X, Share2, PlusSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useInstall } from "../context/InstallContext";

const DISMISS_KEY = "chathere-pwa-dismissed";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const InstallBanner = () => {
  const { canInstall, isInstalled, promptInstall, isIOS } = useInstall();
  const [isDismissed, setIsDismissed] = useState(true);
  const [isPrompting, setIsPrompting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const timeSince = Date.now() - Number(dismissedAt);
        if (timeSince < SEVEN_DAYS_MS) {
          setIsDismissed(true);
          return;
        }
      }
      setIsDismissed(false);
    } catch {
      setIsDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch (e) {
      // Ignore localStorage errors
    }
  };

  const handleInstallClick = async () => {
    setIsPrompting(true);
    try {
      await promptInstall();
    } finally {
      setIsPrompting(false);
    }
  };

  // Hide if already running standalone or installed, or user dismissed within 7 days
  if (isInstalled || isDismissed) {
    return null;
  }

  // Only show if can install or is iOS
  if (!canInstall && !isIOS) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
        className="px-3 pt-2 pb-1 overflow-hidden"
      >
        <div
          className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl shadow-sm text-xs"
          style={{
            background: "rgba(99, 102, 241, 0.12)",
            border: "1px solid rgba(99, 102, 241, 0.28)",
            color: "var(--text-primary)",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(99, 102, 241, 0.22)" }}
            >
              {isIOS ? (
                <Share2 size={14} className="text-indigo-500" />
              ) : (
                <Download size={14} className="text-indigo-500" />
              )}
            </div>

            {isIOS ? (
              <div className="text-[11px] leading-tight text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">Install app:</span>{" "}
                Tap <Share2 size={11} className="inline mx-0.5 text-indigo-400" /> Share then{" "}
                <PlusSquare size={11} className="inline mx-0.5 text-indigo-400" />{" "}
                Add to Home Screen.
              </div>
            ) : (
              <div className="min-w-0">
                <div className="font-semibold text-[var(--text-primary)] leading-tight truncate">
                  Install ChatHere
                </div>
                <div className="text-[10px] text-[var(--text-muted)] leading-tight truncate">
                  Add to home screen for fullscreen & fast access
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {canInstall && !isIOS && (
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={isPrompting}
                className="px-2.5 py-1 text-[11px] font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm disabled:opacity-50"
                style={{ touchAction: "manipulation" }}
              >
                {isPrompting ? "..." : "Install"}
              </button>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Dismiss install banner"
              style={{ touchAction: "manipulation" }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InstallBanner;
