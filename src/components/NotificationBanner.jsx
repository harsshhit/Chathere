import React, { useState, useEffect } from "react";
import { Bell, X, Share2, PlusSquare } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  getPermissionState,
  requestNotificationPermission,
  isIOS,
  isStandalone,
} from "../utils/notify";

const NotificationBanner = () => {
  const [dismissed, setDismissed] = useState(true);
  const [permissionState, setPermissionState] = useState("granted");
  const [isIOSNonStandalone, setIsIOSNonStandalone] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isDismissed = sessionStorage.getItem("chathere-notification-banner-dismissed") === "true";
    const currentPerm = getPermissionState();
    const iosNonStandalone = isIOS() && !isStandalone();

    setPermissionState(currentPerm);
    setIsIOSNonStandalone(iosNonStandalone);

    // Show banner only if not dismissed and either:
    // (1) iOS Safari not installed yet, or
    // (2) notification permission is in 'default' state
    if (!isDismissed && (iosNonStandalone || currentPerm === "default")) {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("chathere-notification-banner-dismissed", "true");
    } catch (e) {
      // Ignore storage error
    }
  };

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        setPermissionState("granted");
        setDismissed(true);
      } else {
        setPermissionState(getPermissionState());
      }
    } finally {
      setIsRequesting(false);
    }
  };

  if (dismissed || permissionState === "granted" || permissionState === "denied") {
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
            background: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(99, 102, 241, 0.25)",
            color: "var(--text-primary)",
          }}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(99, 102, 241, 0.2)" }}
            >
              <Bell size={14} className="text-indigo-500" />
            </div>
            {isIOSNonStandalone ? (
              <div className="text-[11px] leading-tight text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">
                  On iPhone:
                </span>{" "}
                Add ChatHere to your Home Screen to get notifications (Tap{" "}
                <Share2 size={11} className="inline mx-0.5 text-indigo-400" />{" "}
                Share &gt;{" "}
                <PlusSquare size={11} className="inline mx-0.5 text-indigo-400" />{" "}
                Add to Home Screen).
              </div>
            ) : (
              <div className="min-w-0">
                <div className="font-semibold text-[var(--text-primary)] leading-tight truncate">
                  Turn on message notifications
                </div>
                <div className="text-[10px] text-[var(--text-muted)] leading-tight truncate">
                  Get notified when friends send you messages
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!isIOSNonStandalone && (
              <button
                onClick={handleEnable}
                disabled={isRequesting}
                className="px-2.5 py-1 text-[11px] font-semibold text-white rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm disabled:opacity-50"
                style={{ touchAction: "manipulation" }}
              >
                {isRequesting ? "..." : "Enable"}
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              aria-label="Dismiss notification prompt"
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

export default NotificationBanner;
