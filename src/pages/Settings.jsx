import React, { useCallback, useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Bell, ChevronRight, Download, LogOut, Moon, PlusSquare, Send, Share2, Shield, Smartphone, Sun, Volume2, VolumeX, Eye, EyeOff, Music, Check } from "lucide-react";
import { signOut } from "firebase/auth";
import appPackage from "../../package.json";
import { AuthContext } from "../context/AuthContext";
import { auth } from "../firebase";
import { useInstall } from "../context/InstallContext";
import { useTheme } from "../context/ThemeContext";
import { getPermissionState, requestNotificationPermission, notifyMessage, isIOS, isStandalone, getNotificationSettings, saveNotificationSettings, playTonePreview } from "../utils/notify";
import { ScreenHeader, Section, SettingsGroup, SettingsRow, Toggle, Segmented, Sheet } from "../components/ui";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const TONES = [
  { id: "chime", label: "Chime" },
  { id: "ping", label: "Ping" },
  { id: "pop", label: "Pop" },
  { id: "bell", label: "Bell" },
];

const Settings = () => {
  const { currentUser } = useContext(AuthContext);
  const { theme, setTheme } = useTheme();
  const { canInstall, isInstalled, promptInstall, isIOS: isInstallIOS } = useInstall();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const location = useLocation();
  const notificationsScreen = location.pathname === "/settings/notifications";
  const [permissionState, setPermissionState] = useState(() => getPermissionState());
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);
  const [notifSettings, setNotifSettings] = useState(() => getNotificationSettings());
  const [testSent, setTestSent] = useState(false);
  const [error, setError] = useState("");
  const [showSignOut, setShowSignOut] = useState(false);
  const [enterToSend, setEnterToSend] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = window.localStorage.getItem("chathere:enterToSend");
    return saved === null ? !window.matchMedia("(pointer: coarse)").matches : saved === "true";
  });

  useEffect(() => { window.localStorage.setItem("chathere:enterToSend", String(enterToSend)); }, [enterToSend]);
  useEffect(() => {
    setPermissionState(getPermissionState());
    setIosNeedsInstall(isIOS() && !isStandalone());
    setNotifSettings(getNotificationSettings());
  }, []);

  const saveNotificationOption = (key, value) => {
    const updated = saveNotificationSettings({ [key]: value });
    if (updated) setNotifSettings(updated);
  };
  const requestPermission = async () => {
    if (iosNeedsInstall || ["granted", "denied", "unsupported"].includes(permissionState)) return;
    try {
      await requestNotificationPermission(currentUser);
      setPermissionState(getPermissionState());
    } catch (cause) {
      console.error("Could not enable notifications:", cause);
      setError("Could not enable notifications. Please check your browser permissions.");
    }
  };
  const sendTest = async () => {
    try {
      await notifyMessage({
        chatId: "test-preview",
        title: "ChatHere Test",
        body: "Sample notification! Sound, vibration, and service worker are functioning properly.",
        icon: "/icon-192.png",
      });
      setTestSent(true);
      window.setTimeout(() => setTestSent(false), 3000);
    } catch (error) {
      console.warn("Failed to send test notification:", error);
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
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Could not sign out:", error);
      setError("Could not sign out. Please try again.");
    }
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
          </SettingsGroup>
        </Section>

        <Section title="Notifications">
          <SettingsGroup>
            <div className="settings-row row">
              <Bell size={20} aria-hidden="true" />
              <button type="button" className="settings-row-label settings-row-link" onClick={() => navigate("/settings/notifications", { state: { settingsNotifications: true } })}>Message notifications</button>
              <span className="settings-row-value">{permissionLabel}</span>
              {permissionState === "default" && !iosNeedsInstall && <button type="button" onClick={requestPermission} className="chip min-h-11">Enable</button>}
              <ChevronRight size={17} aria-hidden="true" />
            </div>
          </SettingsGroup>
        </Section>

        <Section title="App">
          <SettingsGroup>
            {(canInstall || isInstalled || isInstallIOS) && <SettingsRow icon={Download} label="Install ChatHere" value={isInstalled ? "Installed" : isInstallIOS ? "Add to Home Screen" : canInstall ? "Available" : ""} onClick={canInstall ? promptInstall : undefined} />}
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
    </div>
    <AnimatePresence>
    {notificationsScreen && <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Notification settings"
      className="settings-subscreen ember-bg"
        initial={reduceMotion ? false : { x: "100%" }}
        animate={{ x: 0 }}
        exit={reduceMotion ? undefined : { x: "100%" }}
        transition={{ duration: reduceMotion ? 0 : .24, ease: "easeOut" }}
      >
        <div className="mx-auto w-full max-w-[640px] pb-6">
          <ScreenHeader title="Notifications">
            <button type="button" onClick={backFromSettings} className="icon-btn-glass" aria-label="Back to settings" autoFocus><ArrowLeft size={19} /></button>
          </ScreenHeader>
          <Section title="Permission">
            <SettingsGroup>
              <SettingsRow icon={Bell} label="Message notifications" value={permissionLabel} control={permissionState === "default" && !iosNeedsInstall
                ? <button type="button" onClick={requestPermission} className="chip min-h-11">{permissionState === "default" ? "Enable" : permissionLabel}</button>
                : null} />
              {iosNeedsInstall && <p className="px-3 py-3 text-sm text-[var(--text-2)]">Install ChatHere to enable notifications on this device.</p>}
            </SettingsGroup>
          </Section>
          <Section title="Message notifications">
            <SettingsGroup>
              <SettingsRow icon={notifSettings.sound ? Volume2 : VolumeX} label="Notification sound" control={<Toggle checked={notifSettings.sound} onChange={(value) => saveNotificationOption("sound", value)} label="Notification sound" />} />
              {notifSettings.sound && <div className="px-3 py-3">
                <div className="mb-2 flex items-center justify-between text-sm text-[var(--text-2)]">
                  <span className="inline-flex items-center gap-2"><Music size={16} />Alert tone</span>
                  <button type="button" onClick={() => playTonePreview(notifSettings.tone)} className="chip min-h-11">Preview</button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {TONES.map((tone) => <button type="button" key={tone.id} onClick={() => {
                    saveNotificationOption("tone", tone.id);
                    playTonePreview(tone.id);
                  }} className={`chip min-h-11 justify-center ${notifSettings.tone === tone.id ? "chip-active" : ""}`}>{tone.label}</button>)}
                </div>
              </div>}
              <SettingsRow icon={Smartphone} label="Vibration" control={<Toggle checked={notifSettings.vibrate} onChange={(value) => saveNotificationOption("vibrate", value)} label="Vibration" />} />
              <SettingsRow icon={notifSettings.showPreview ? Eye : EyeOff} label="Message previews" value={notifSettings.showPreview ? "Show message" : "Hide message"} control={<Toggle checked={notifSettings.showPreview} onChange={(value) => saveNotificationOption("showPreview", value)} label="Message previews" />} />
              {permissionState === "granted" && <SettingsRow icon={Bell} label={testSent ? "Test sent" : "Send test notification"} onClick={sendTest} />}
            </SettingsGroup>
          </Section>
          {error && <p role="alert" className="mx-6 mb-4 text-sm text-[var(--danger-text)]">{error}</p>}
        </div>
      </motion.div>}
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
