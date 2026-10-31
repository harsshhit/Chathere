import React, { lazy, Suspense, useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Bell, ChevronRight, Download, Image as ImageIcon, LogOut, Moon, PlusSquare, Send, Share2, Shield, Sun, Check } from "lucide-react";
import { signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import appPackage from "../../package.json";
import { AuthContext } from "../context/AuthContext";
import { UserDocumentContext, UserDocumentLoadedContext } from "../context/ChatContexts";
import { auth, db } from "../firebase";
import { useInstall } from "../context/InstallContext";
import { useTheme } from "../context/ThemeContext";
import { getPermissionState, requestNotificationPermission, notifyMessage, isIOS, isStandalone, getNotificationSettings, saveNotificationSettings, playTonePreview } from "../utils/notify";
import { ScreenHeader, Section, SettingsGroup, SettingsRow, Toggle, Segmented, Sheet, Toast } from "../components/ui";
import { useMediaPolicy } from "../utils/mediaPolicy";
import { clearMediaCache } from "../utils/mediaCache";
import { clearOwnMediaCache } from "../utils/ownMediaCache";
import { cleanupUserSession } from "../utils/sessionCleanup";

const NotificationSettingsScreen = lazy(() => import("./NotificationSettingsScreen"));

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const Settings = () => {
  const { currentUser } = useContext(AuthContext);
  const userDocument = useContext(UserDocumentContext);
  const userDocumentLoadedUid = useContext(UserDocumentLoadedContext);
  const { theme, setTheme } = useTheme();
  const { dataSaver, setDataSaver } = useMediaPolicy();
  const { canInstall, isInstalled, promptInstall, isIOS: isInstallIOS } = useInstall();
  const navigate = useNavigate();
  const location = useLocation();
  const notificationsScreen = location.pathname === "/settings/notifications";
  const [permissionState, setPermissionState] = useState(() => getPermissionState());
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [notifSettings, setNotifSettings] = useState(() => getNotificationSettings());
  const [testSent, setTestSent] = useState(false);
  const [error, setError] = useState("");
  const [showSignOut, setShowSignOut] = useState(false);
  const [storageUsage, setStorageUsage] = useState(null);
  const [storageToast, setStorageToast] = useState("");
  const [clearingMedia, setClearingMedia] = useState(false);
  const [enterToSend, setEnterToSend] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("chathere:enterToSend");
    return saved === null ? !window.matchMedia("(pointer: coarse)").matches : saved === "true";
  });

  useEffect(() => { window.localStorage.setItem("chathere:enterToSend", String(enterToSend)); }, [enterToSend]);
  useEffect(() => {
    const refreshPermissionState = () => {
      setPermissionState(getPermissionState());
      setIosNeedsInstall(isIOS() && !isStandalone());
    };
    refreshPermissionState();
    setNotifSettings(getNotificationSettings());
    window.addEventListener("focus", refreshPermissionState);
    document.addEventListener("visibilitychange", refreshPermissionState);
    return () => {
      window.removeEventListener("focus", refreshPermissionState);
      document.removeEventListener("visibilitychange", refreshPermissionState);
    };
  }, []);
  useEffect(() => {
    if (!currentUser?.uid || userDocumentLoadedUid !== currentUser.uid) return;
    const localSettings = getNotificationSettings();
    const storedSettings = userDocument.notificationSettings || {};
    const merged = { ...localSettings, ...storedSettings };
    setNotifSettings(merged);
    saveNotificationSettings(merged);

    if (
      typeof storedSettings.showPreview !== "boolean" ||
      typeof storedSettings.vibrate !== "boolean"
    ) {
      setDoc(doc(db, "users", currentUser.uid), {
        notificationSettings: {
          showPreview: merged.showPreview,
          vibrate: merged.vibrate,
        },
      }, { merge: true }).catch((cause) => {
        console.error("Could not sync notification preferences:", cause);
        setError("Could not sync notification preferences. Please try again.");
      });
    }
  }, [currentUser?.uid, userDocument.notificationSettings, userDocumentLoadedUid]);
  const refreshStorageEstimate = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return;
    try {
      const estimate = await navigator.storage.estimate();
      setStorageUsage({
        usage: Number.isFinite(estimate.usage) ? estimate.usage : null,
        quota: Number.isFinite(estimate.quota) ? estimate.quota : null,
      });
    } catch (cause) {
      console.warn("Could not estimate browser storage:", cause);
    }
  }, []);
  useEffect(() => { refreshStorageEstimate(); }, [refreshStorageEstimate]);

  const saveNotificationOption = (key, value) => {
    setError("");
    const updated = saveNotificationSettings({ [key]: value });
    if (updated) setNotifSettings(updated);
    if (["showPreview", "vibrate"].includes(key) && currentUser?.uid) {
      setDoc(doc(db, "users", currentUser.uid), {
        notificationSettings: { [key]: value },
      }, { merge: true }).catch((cause) => {
        console.error("Could not save notification preference:", cause);
        setError("Could not sync this notification preference. Please try again.");
      });
    }
  };
  const requestPermission = async () => {
    if (iosNeedsInstall || ["granted", "denied", "unsupported"].includes(permissionState)) return;
    setError("");
    try {
      await requestNotificationPermission(currentUser);
      setPermissionState(getPermissionState());
    } catch (cause) {
      console.error("Could not enable notifications:", cause);
      setPermissionState(getPermissionState());
      setError("Could not enable notifications. Please check your browser permissions.");
    }
  };
  const sendTest = async () => {
    setError("");
    try {
      const displayed = await notifyMessage({
        chatId: "test-preview",
        title: "ChatHere Test",
        body: "Test notification from ChatHere. Your current notification preferences apply.",
        icon: "/icon-192.png",
      });
      if (!displayed) {
        setError("Could not display a test notification. Check notification permission and browser support.");
        return;
      }
      setTestSent(true);
      window.setTimeout(() => setTestSent(false), 3000);
    } catch (cause) {
      console.error("Failed to send test notification:", cause);
      setError("Could not display a test notification. Please try again.");
    }
  };
  const setOverlay = (open) => window.dispatchEvent(new CustomEvent("chathere:mobile-overlay", { detail: { open } }));
  const openSignOut = () => { setShowSignOut(true); setOverlay(true); };
  const closeSignOut = () => { setShowSignOut(false); setOverlay(false); };
  const backFromSettings = useCallback(() => {
    if (notificationsScreen) {
      if (location.state?.settingsNotifications && window.history.state?.idx > 0) navigate(-1);
      else navigate("/settings", { replace: true });
    } else if (location.state?.mobileTabSwitch && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  }, [location.state, navigate, notificationsScreen]);
  useEffect(() => {
    if (!notificationsScreen || showSignOut) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        backFromSettings();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [backFromSettings, notificationsScreen, showSignOut]);
  const performSignOut = async () => {
    try {
      closeSignOut();
      await cleanupUserSession(currentUser?.uid);
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Could not sign out:", error);
      setError("Could not sign out. Please try again.");
    }
  };
  const clearCachedMedia = async () => {
    if (clearingMedia || !window.confirm("Clear cached media? Chat history will not be deleted.")) return;
    setClearingMedia(true);
    setError("");
    try {
      await clearMediaCache();
      clearOwnMediaCache();
      if (typeof navigator !== "undefined" && navigator.serviceWorker) {
        const registration = await navigator.serviceWorker.getRegistration();
        const worker = navigator.serviceWorker.controller || registration?.active;
        if (worker && typeof MessageChannel !== "undefined") {
          await new Promise((resolve, reject) => {
            const channel = new MessageChannel();
            const timeout = window.setTimeout(() => {
              channel.port1.close();
              reject(new Error("The service worker did not respond."));
            }, 5000);
            channel.port1.onmessage = (event) => {
              window.clearTimeout(timeout);
              channel.port1.close();
              if (event.data?.ok) resolve();
              else reject(new Error(event.data?.error || "Could not clear service-worker media caches."));
            };
            worker.postMessage({ type: "CLEAR_MEDIA_CACHE" }, [channel.port2]);
          });
        }
      }
      await refreshStorageEstimate();
      setStorageToast("Media cache cleared. Chat history was kept.");
      window.setTimeout(() => setStorageToast(""), 3000);
    } catch (cause) {
      console.error("Could not clear cached media:", cause);
      setError("Could not clear all cached media. Please try again.");
    } finally {
      setClearingMedia(false);
    }
  };
  const formatStorageSize = (bytes) => {
    if (!Number.isFinite(bytes)) return "Unavailable";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const permissionLabel = iosNeedsInstall
    ? "PWA required"
    : permissionState === "granted" ? "On"
      : permissionState === "denied" ? "Blocked"
        : permissionState === "unsupported" ? "Unsupported" : "Off";

  return <main data-main-scroll className="ember-bg relative h-full overflow-y-auto overscroll-contain tab-scroll-padding">
    <div className="mx-auto w-full max-w-[640px] pb-6" aria-hidden={notificationsScreen}>
      <ScreenHeader title="Settings" action={null}>
        <button type="button" onClick={backFromSettings} className="desktop-settings-back icon-btn-glass" aria-label="Back to chats"><ArrowLeft size={19} /></button>
      </ScreenHeader>

        <Section title="Appearance">
          <SettingsGroup>
            <div className="settings-row row">
              {theme === "dark" ? <Moon size={20} /> : <Sun size={20} />}
              <span className="settings-row-label">Theme</span>
              <Segmented value={theme} options={THEME_OPTIONS} onChange={setTheme} label="Appearance theme" />
            </div>
          </SettingsGroup>
        </Section>

        <Section title="Chats">
          <SettingsGroup>
            <SettingsRow icon={Send} label="Enter to send" value={enterToSend ? "On" : "Off"} control={<Toggle checked={enterToSend} onChange={setEnterToSend} label="Enter to send" />} />
            <SettingsRow icon={ImageIcon} label="Data saver" value="Don't auto-load media" control={<Toggle checked={dataSaver} onChange={setDataSaver} label="Data saver: don't auto-load media" />} />
          </SettingsGroup>
        </Section>

        <Section title="Storage">
          <SettingsGroup>
            <SettingsRow icon={ImageIcon} label="Approx. storage used" value={storageUsage ? `${formatStorageSize(storageUsage.usage)} / ${formatStorageSize(storageUsage.quota)}` : "Unavailable"} />
            <SettingsRow
              icon={ImageIcon}
              label="Clear media cache"
              value={clearingMedia ? "Clearing…" : "Chat history is kept"}
              onClick={clearCachedMedia}
              className={clearingMedia ? "pointer-events-none opacity-60" : ""}
            />
          </SettingsGroup>
          <p className="px-1 pt-2 text-xs text-[var(--text-muted)]">Clearing cached media does not delete chat history.</p>
        </Section>

        <Section title="Notifications">
          <SettingsGroup>
            <div className="settings-row row">
              <Bell size={20} aria-hidden="true" />
              <button
                type="button"
                className="settings-row-label settings-row-link"
                onPointerEnter={() => import("./NotificationSettingsScreen").catch((cause) => console.error("Could not preload notification settings:", cause))}
                onFocus={() => import("./NotificationSettingsScreen").catch((cause) => console.error("Could not preload notification settings:", cause))}
                onTouchStart={() => import("./NotificationSettingsScreen").catch((cause) => console.error("Could not preload notification settings:", cause))}
                onClick={() => navigate("/settings/notifications", { state: { settingsNotifications: true } })}
              >Message notifications</button>
              <span className="settings-row-value">{permissionLabel}</span>
              {permissionState === "default" && !iosNeedsInstall && <button type="button" onClick={requestPermission} className="chip min-h-11">Enable</button>}
              <ChevronRight size={17} aria-hidden="true" />
            </div>
          </SettingsGroup>
        </Section>

        <Section title="App">
          <SettingsGroup>
            <SettingsRow icon={Download} label="Install ChatHere" value={isInstalled ? "Installed" : isInstallIOS ? "Add to Home Screen" : canInstall ? "Available" : "Unavailable"} onClick={canInstall ? promptInstall : undefined} />
            {!isInstalled && isInstallIOS && <p className="px-3 py-3 text-sm text-[var(--text-2)]">On iPhone: tap <Share2 size={14} className="mx-1 inline" /> Share, then <PlusSquare size={14} className="mx-1 inline" /> Add to Home Screen.</p>}
            <SettingsRow icon={Shield} label="Encryption & privacy" value="Active" />
          </SettingsGroup>
        </Section>

        <Section title="About">
          <SettingsGroup>
            <SettingsRow icon={Check} label="ChatHere" value={`Version ${appPackage.version}`} />
          </SettingsGroup>
        </Section>

        <Section title="Account">
          <SettingsGroup><SettingsRow icon={LogOut} label="Sign out" danger onClick={openSignOut} /></SettingsGroup>
        </Section>
      {error && <p role="alert" className="mx-6 mb-4 text-sm text-[var(--danger-text)]">{error}</p>}
        {storageToast && <Toast className="bottom-24">{storageToast}</Toast>}
    </div>
    <AnimatePresence>
      {notificationsScreen && <Suspense key="notifications" fallback={<div className="settings-subscreen p-4" aria-label="Loading notification settings"><div className="h-8 w-40 animate-pulse rounded-xl bg-[var(--surface-3)]" /><div className="mt-5 h-40 animate-pulse rounded-2xl bg-[var(--surface-2)]" /></div>}>
        <NotificationSettingsScreen
          backFromSettings={backFromSettings}
          permissionLabel={permissionLabel}
          permissionState={permissionState}
          iosNeedsInstall={iosNeedsInstall}
          requestPermission={requestPermission}
          notifSettings={notifSettings}
          saveNotificationOption={saveNotificationOption}
          playTonePreview={playTonePreview}
          testSent={testSent}
          sendTest={sendTest}
          error={error}
        />
      </Suspense>}
    </AnimatePresence>
    <Sheet open={showSignOut} onClose={closeSignOut} title="Sign out?">
      <p className="py-2 text-sm text-[var(--text-2)]">Are you sure you want to sign out of ChatHere?</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={closeSignOut} className="chip min-h-11 flex-1 justify-center">Cancel</button>
        <button type="button" onClick={performSignOut} className="min-h-11 flex-1 rounded-full bg-[var(--danger)] text-sm font-semibold text-[var(--on-danger)]">Sign out</button>
      </div>
    </Sheet>
  </main>;
};

export default Settings;
