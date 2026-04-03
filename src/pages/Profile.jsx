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

const Profile = () => {
  const { currentUser } = useContext(AuthContext);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(currentUser.displayName);
  const [bio, setBio] = useState("");
  const [newBio, setNewBio] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [savingName, setSavingName] = useState(false);
  const [savingBio, setSavingBio] = useState(false);

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
    fetchBio();
  }, [currentUser.uid]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
    if (!newDisplayName.trim()) return;
    setSavingName(true);
    try {
      await updateProfile(currentUser, { displayName: newDisplayName });
      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName: newDisplayName,
      });
      setIsEditingName(false);
      window.location.reload();
    } catch (err) {
      console.error(err);
    } finally {
      setSavingName(false);
    }
  };

  const handleBioUpdate = async () => {
    setSavingBio(true);
    try {
      await updateDoc(doc(db, "users", currentUser.uid), { bio: newBio });
      setBio(newBio);
      setIsEditingBio(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingBio(false);
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

  const memberSince = new Date(
    currentUser.metadata.creationTime
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--surface)" }}
    >
      {/* Top bar */}
      <div
        className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
        style={{
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={() => navigate("/")}
          className="icon-btn -ml-1"
          title="Back to chats"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="brand-logo text-xl">Quawk</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 py-10 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="glass-card p-8 sm:p-10">

            {/* Avatar */}
            <div className="flex justify-center mb-8">
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

                {/* Upload overlay */}
                <button
                  onClick={() => fileInputRef.current.click()}
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

            {/* Upload progress */}
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

            {/* Fields */}
            <div className="space-y-5">

              {/* Display name */}
              <div>
                <label
                  className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
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
                        className="flex-1 px-3 py-2 text-sm rounded-xl outline-none transition-all duration-200"
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
                        className="p-2 rounded-xl transition-colors duration-200"
                        style={{ background: "var(--primary)", color: "white" }}
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => { setIsEditingName(false); setNewDisplayName(currentUser.displayName); }}
                        className="p-2 rounded-xl transition-colors duration-200"
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
                      <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
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

              {/* Email (read-only) */}
              <div>
                <label
                  className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
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
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    {currentUser.email}
                  </span>
                </div>
              </div>

              {/* Bio */}
              <div>
                <label
                  className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
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
                        className="w-full px-3 py-2.5 text-sm rounded-xl outline-none resize-none transition-all duration-200"
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
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors duration-200"
                          style={{ background: "var(--primary)", color: "white" }}
                        >
                          <Check size={13} />
                          Save
                        </button>
                        <button
                          onClick={() => { setIsEditingBio(false); setNewBio(bio); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors duration-200"
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

              {/* Member since */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--border)",
                }}
              >
                <Calendar size={14} style={{ color: "var(--text-muted)" }} className="flex-shrink-0" />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  Member since {memberSince}
                </span>
              </div>

              {/* Logout */}
              <div className="pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#f87171",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                    e.currentTarget.style.borderColor = "rgba(239,68,68,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                    e.currentTarget.style.borderColor = "rgba(239,68,68,0.2)";
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
    </div>
  );
};

export default Profile;
