import React, { useContext, useRef, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Calendar,
  Edit2,
  LogOut,
  Check,
  X,
  Camera,
  ArrowLeft,
  Bell,
  Shield,
  AlertTriangle,
  Sun,
  Moon,
  Send,
  Share2,
  PlusSquare,
} from "lucide-react";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import Avatar from "../components/Avatar";
import {
  getPermissionState,
  requestNotificationPermission,
  notifyMessage,
  isIOS,
  isStandalone,
} from "../utils/notify";
import { useTheme } from "../context/ThemeContext";

const Profile = () => {
  const { currentUser } = useContext(AuthContext);
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(currentUser.displayName || "");
  const [bio, setBio] = useState("");
  const [newBio, setNewBio] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [savingName, setSavingName] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [permissionState, setPermissionState] = useState(() => getPermissionState());
  const [isIOSNonStandalone, setIsIOSNonStandalone] = useState(false);
  const [testNotificationSent, setTestNotificationSent] = useState(false);

  useEffect(() => {
    setPermissionState(getPermissionState());
    setIsIOSNonStandalone(isIOS() && !isStandalone());
  }, []);

  useEffect(() => {
    const fetchBio = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setBio(data.bio || "");
          setNewBio(data.bio || "");
        }
      } catch (err) {
        console.error("Error fetching bio:", err);
      }
    };
    if (currentUser?.uid) fetchBio();
  }, [currentUser?.uid]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be under 5MB");
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `profile_pictures/${currentUser.uid}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          setUploadProgress(
            Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          );
        },
        (err) => {
          console.error(err);
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await updateProfile(currentUser, { photoURL: downloadURL });
          await updateDoc(doc(db, "users", currentUser.uid), { photoURL: downloadURL });
          setUploading(false);
          window.location.reload();
        }
      );
    } catch (err) {
      console.error(err);
      setUploading(false);
    }
  };

  const handleNameUpdate = async () => {
    if (!newDisplayName.trim() || newDisplayName.length < 2) {
      alert("Display name must be at least 2 characters.");
      return;
    }
    setSavingName(true);
    try {
      await updateProfile(currentUser, { displayName: newDisplayName.trim() });
      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName: newDisplayName.trim(),
      });
      setIsEditingName(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingName(false);
    }
  };

  const handleBioUpdate = async () => {
    setSavingBio(true);
    try {
      await updateDoc(doc(db, "users", currentUser.uid), { bio: newBio.trim() });
      setBio(newBio.trim());
      setIsEditingBio(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingBio(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (isIOSNonStandalone) return;
    if (permissionState === "granted" || permissionState === "denied" || permissionState === "unsupported") {
      return;
    }
    await requestNotificationPermission();
    setPermissionState(getPermissionState());
  };

  const handleSendTestNotification = async () => {
    try {
      await notifyMessage({
        chatId: "test-preview",
        title: "ChatHere Test",
        body: "Sample notification! Sound, vibration, and service worker are functioning properly.",
        icon: "/icon-192.png",
      });
      setTestNotificationSent(true);
      setTimeout(() => setTestNotificationSent(false), 3000);
    } catch (err) {
      console.warn("Failed to send test notification:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error(err);
    }
  };

  const memberSince = currentUser?.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
    : "Recently";

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <div
      className="min-h-[100vh] min-h-[100dvh] flex flex-col"
      style={{ background: "var(--surface)" }}
    >
      <div
        className="px-4 py-3 flex items-center justify-between flex-shrink-0 safe-top"
        style={{
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="icon-btn -ml-1"
            title="Back"
            aria-label="Back"
            style={{ touchAction: "manipulation" }}
          >
            <ArrowLeft size={20} />
          </button>
          <span className="brand-logo text-xl">ChatHere</span>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-8 sm:py-12 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="glass-card p-6 sm:p-8">
            <div className="flex justify-center mb-6">
              <div className="relative group">
                <motion.div
                  className="w-24 h-24 rounded-3xl object-cover overflow-hidden"
                  whileHover={{ scale: 1.03 }}
                  style={{
                    border: "2px solid rgba(99,102,241,0.5)",
                    boxShadow: "0 0 40px rgba(99,102,241,0.25)",
                    background: "var(--surface)",
                  }}
                >
                  <Avatar
                    src={currentUser.photoURL}
                    alt={currentUser.displayName}
                    className="w-full h-full object-cover"
                  />
                </motion.div>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-3xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                  title="Change photo"
                >
                  <Camera size={22} className="text-white" />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            </div>

            <AnimatePresence>
              {uploading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-5"
                >
                  <div
                    className="h-1.5 rounded-full overflow-hidden mb-1"
                    style={{ background: "var(--surface-4)" }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "var(--primary)", width: `${uploadProgress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                  <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                    Uploading… {uploadProgress}%
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-[10px] font-bold mb-1 uppercase tracking-wider text-[var(--text-muted)]"
                >
                  Display name
                </label>
                <AnimatePresence mode="wait">
                  {isEditingName ? (
                    <motion.div
                      key="editing-name"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleNameUpdate()}
                        className="flex-1 px-3 py-2 text-sm rounded-xl outline-none"
                        style={{
                          background: "var(--surface-3)",
                          border: "1px solid rgba(99,102,241,0.5)",
                          color: "var(--text-primary)",
                        }}
                        autoFocus
                      />
                      <button
                        onClick={handleNameUpdate}
                        disabled={savingName}
                        className="p-2 rounded-xl"
                        style={{ background: "var(--primary)", color: "white" }}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => { setIsEditingName(false); setNewDisplayName(currentUser.displayName || ""); }}
                        className="p-2 rounded-xl"
                        style={{ background: "var(--surface-4)", color: "var(--text-muted)" }}
                      >
                        <X size={16} />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="display-name"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={{
                        background: "var(--surface-3)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {currentUser.displayName}
                      </span>
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="icon-btn p-1.5 ml-2 flex-shrink-0"
                        title="Edit name"
                      >
                        <Edit2 size={14} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label
                  className="block text-[10px] font-bold mb-1 uppercase tracking-wider text-[var(--text-muted)]"
                >
                  Email
                </label>
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{
                    background: "var(--surface-3)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Mail size={14} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                  <span className="text-sm text-[var(--text-secondary)]">
                    {currentUser.email}
                  </span>
                </div>
              </div>

              <div>
                <label
                  className="block text-[10px] font-bold mb-1 uppercase tracking-wider text-[var(--text-muted)]"
                >
                  Bio
                </label>
                <AnimatePresence mode="wait">
                  {isEditingBio ? (
                    <motion.div
                      key="editing-bio"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2"
                    >
                      <textarea
                        value={newBio}
                        onChange={(e) => setNewBio(e.target.value)}
                        placeholder="Write something about yourself…"
                        rows={3}
                        maxLength={160}
                        className="w-full px-3 py-2 text-sm rounded-xl outline-none resize-none"
                        style={{
                          background: "var(--surface-3)",
                          border: "1px solid rgba(99,102,241,0.5)",
                          color: "var(--text-primary)",
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleBioUpdate}
                          disabled={savingBio}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl"
                          style={{ background: "var(--primary)", color: "white" }}
                        >
                          <Check size={13} />
                          Save
                        </button>
                        <button
                          onClick={() => { setIsEditingBio(false); setNewBio(bio); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl"
                          style={{ background: "var(--surface-4)", color: "var(--text-muted)" }}
                        >
                          <X size={13} />
                          Cancel
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="display-bio"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start justify-between px-3 py-2.5 rounded-xl"
                      style={{
                        background: "var(--surface-3)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span
                        className="text-sm"
                        style={{ color: bio ? "var(--text-secondary)" : "var(--text-muted)" }}
                      >
                        {bio || "No bio yet"}
                      </span>
                      <button
                        onClick={() => setIsEditingBio(true)}
                        className="icon-btn p-1.5 ml-2 flex-shrink-0"
                        title="Edit bio"
                      >
                        <Edit2 size={14} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label className="block text-[10px] font-bold mb-1 uppercase tracking-wider text-[var(--text-muted)]">
                  Preferences & Appearance
                </label>
                <div className="space-y-2">
                  <div
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                      {theme === "dark" ? (
                        <Moon size={15} className="text-indigo-400" />
                      ) : (
                        <Sun size={15} className="text-amber-500" />
                      )}
                      <span>Appearance</span>
                    </div>

                    <div
                      role="radiogroup"
                      aria-label="Theme selector"
                      className="flex items-center p-1 rounded-lg gap-1 relative"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                    >
                      <button
                        type="button"
                        role="radio"
                        aria-checked={theme === "light"}
                        aria-label="Light theme"
                        onClick={() => setTheme("light")}
                        className={`relative z-10 flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${theme === "light"
                            ? "text-[var(--primary-light)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          }`}
                      >
                        <Sun size={13} />
                        <span>Light</span>
                        {theme === "light" && (
                          <motion.div
                            layoutId="theme-indicator"
                            className="absolute inset-0 rounded-md -z-10 shadow-sm"
                            style={{
                              background: "var(--surface-3)",
                              border: "1px solid var(--border-light)",
                            }}
                            transition={{ type: "spring", stiffness: 300, damping: 28 }}
                          />
                        )}
                      </button>

                      <button
                        type="button"
                        role="radio"
                        aria-checked={theme === "dark"}
                        aria-label="Dark theme"
                        onClick={() => setTheme("dark")}
                        className={`relative z-10 flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${theme === "dark"
                            ? "text-[var(--primary-light)]"
                            : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          }`}
                      >
                        <Moon size={13} />
                        <span>Dark</span>
                        {theme === "dark" && (
                          <motion.div
                            layoutId="theme-indicator"
                            className="absolute inset-0 rounded-md -z-10 shadow-sm"
                            style={{
                              background: "var(--surface-4)",
                              border: "1px solid var(--border-light)",
                            }}
                            transition={{ type: "spring", stiffness: 300, damping: 28 }}
                          />
                        )}
                      </button>
                    </div>
                  </div>

                  <div
                    className="p-3 rounded-xl space-y-2.5 transition-colors"
                    style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
                  >
                    <div
                      onClick={handleToggleNotifications}
                      className={`flex items-center justify-between ${
                        permissionState === "default" && !isIOSNonStandalone
                          ? "cursor-pointer hover:opacity-90"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                        <Bell size={15} className="text-indigo-400" />
                        <span>Message Notifications</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isIOSNonStandalone ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                            PWA Required
                          </span>
                        ) : permissionState === "granted" ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-[var(--success-text)]">
                            Enabled
                          </span>
                        ) : permissionState === "denied" ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                            Blocked
                          </span>
                        ) : permissionState === "unsupported" ? (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-4)] text-[var(--text-muted)]">
                            Not supported
                          </span>
                        ) : (
                          <button
                            onClick={handleToggleNotifications}
                            className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
                          >
                            Enable
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Contextual hints depending on real permission state */}
                    {isIOSNonStandalone ? (
                      <div className="text-xs text-[var(--text-muted)] pt-1 border-t border-[var(--border)] leading-relaxed">
                        On iPhone, add ChatHere to your Home Screen to get notifications: tap <Share2 size={12} className="inline text-indigo-400 mx-0.5" /> Share &gt; <PlusSquare size={12} className="inline text-indigo-400 mx-0.5" /> Add to Home Screen.
                      </div>
                    ) : permissionState === "denied" ? (
                      <div className="text-xs text-red-400/90 pt-1 border-t border-[var(--border)] leading-relaxed">
                        Notifications are blocked by your browser. To unblock, tap the lock/tune icon in your browser address bar and allow notifications for this site.
                      </div>
                    ) : permissionState === "unsupported" ? (
                      <div className="text-xs text-[var(--text-muted)] pt-1 border-t border-[var(--border)] leading-relaxed">
                        Your browser does not support web notifications or service workers.
                      </div>
                    ) : null}

                    {/* Step 6 Debug Tooling: Test notification button when granted */}
                    {permissionState === "granted" && (
                      <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)]">
                          Test OS-level alert & chime
                        </span>
                        <button
                          onClick={handleSendTestNotification}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm"
                          style={{ touchAction: "manipulation" }}
                        >
                          <Send size={11} />
                          <span>{testNotificationSent ? "Notification sent!" : "Send test notification"}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}
                  >
                    <div className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                      <Shield size={15} className="text-indigo-400" />
                      <span>Encryption & Privacy</span>
                    </div>
                    <span className="text-xs text-indigo-400 font-semibold">Active</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "var(--surface-3)", border: "1px solid var(--border)" }}>
                <Calendar size={14} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                <span className="text-sm text-[var(--text-secondary)]">
                  Member since {memberSince}
                </span>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowLogoutConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171",
                  }}
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "var(--overlay)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-6 max-w-sm w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-3 border border-red-500/20">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>Confirm Sign Out</h3>
              <p className="text-xs mb-5" style={{ color: "var(--text-muted)" }}>
                Are you sure you want to sign out of ChatHere?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background: "var(--surface-3)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
