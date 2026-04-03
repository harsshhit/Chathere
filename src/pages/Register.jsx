import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from "firebase/auth";
import { auth, db, storage, googleProvider } from "../firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { User, Mail, Lock, ImagePlus, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const Register = () => {
  const [err, setErr] = useState(false);
  const [errMsg, setErrMsg] = useState("Something went wrong. Please try again.");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const navigate = useNavigate();

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setErr(false);
      const res = await createUserWithEmailAndPassword(auth, email, password);
      
      let downloadURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;

      if (avatar) {
        const date = new Date().getTime();
        const fileName = `${displayName}-${date}`;
        const storageRef = ref(storage, fileName);
        const uploadTask = uploadBytesResumable(storageRef, avatar);

        await new Promise((resolve, reject) => {
          uploadTask.on("state_changed", null, reject, () => {
            getDownloadURL(storageRef)
              .then((url) => {
                downloadURL = url;
                resolve();
              })
              .catch(reject);
          });
        });
      }

      await updateProfile(res.user, { displayName, photoURL: downloadURL });
      await setDoc(doc(db, "users", res.user.uid), {
        uid: res.user.uid,
        displayName,
        email,
        photoURL: downloadURL,
      });
      await setDoc(doc(db, "userChats", res.user.uid), {});

      navigate("/");
    } catch (error) {
      console.error(error);
      setErr(true);
      if (error.code === "auth/email-already-in-use") {
        setErrMsg("An account with this email already exists.");
      } else if (error.code === "auth/weak-password") {
        setErrMsg("Password should be at least 6 characters.");
      } else {
        setErrMsg("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      setGoogleLoading(true);
      setErr(false);
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userChatsDoc = await getDoc(doc(db, "userChats", user.uid));

      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        });
      }
      if (!userChatsDoc.exists()) {
        await setDoc(doc(db, "userChats", user.uid), {});
      }
      navigate("/");
    } catch (error) {
      console.error(error);
      setErr(true);
      setErrMsg("Google sign-up failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  const passwordStrength = () => {
    if (password.length === 0) return null;
    if (password.length < 6) return { label: "Weak", color: "#ef4444", width: "33%" };
    if (password.length < 10) return { label: "Medium", color: "#f59e0b", width: "66%" };
    return { label: "Strong", color: "#22c55e", width: "100%" };
  };

  const strength = passwordStrength();

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4 sm:p-6">
      {/* Decorative orbs */}
      <div
        className="pointer-events-none fixed top-0 left-0 w-[500px] h-[500px] rounded-full opacity-15"
        style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)", filter: "blur(60px)", transform: "translate(-40%, -30%)" }}
      />
      <div
        className="pointer-events-none fixed bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-15"
        style={{ background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)", filter: "blur(60px)", transform: "translate(30%, 30%)" }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[440px]"
      >
        <div className="glass-card p-8 sm:p-10">
          {/* Header */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0} className="mb-7 text-center">
            <h1 className="brand-logo text-4xl mb-1.5">Quawk</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Create your account — it's free
            </p>
          </motion.div>

          {/* Avatar picker */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="flex justify-center mb-6">
            <label htmlFor="register-avatar" className="cursor-pointer group">
              <div className="relative">
                {avatarPreview ? (
                  <>
                    <img
                      src={avatarPreview}
                      alt="Avatar preview"
                      className="w-20 h-20 rounded-2xl object-cover"
                      style={{ border: "2px solid rgba(99,102,241,0.6)", boxShadow: "0 8px 24px rgba(99,102,241,0.3)" }}
                    />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                      <CheckCircle2 size={14} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div
                    className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all duration-200"
                    style={{
                      background: "var(--surface-3)",
                      border: "2px dashed rgba(99,102,241,0.4)",
                    }}
                  >
                    <ImagePlus size={20} style={{ color: "var(--text-muted)" }} />
                    <span className="text-[10px] text-center leading-tight" style={{ color: "var(--text-muted)" }}>Photo<br/>(Optional)</span>
                  </div>
                )}
              </div>
              <input
                type="file"
                id="register-avatar"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Display name */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
              <input
                required
                type="text"
                placeholder="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="auth-input"
                id="register-name"
              />
            </motion.div>

            {/* Email */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3} className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
              <input
                required
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                id="register-email"
              />
            </motion.div>

            {/* Password */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4} className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
              <input
                required
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input pr-10"
                id="register-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200"
                style={{ color: "var(--text-muted)" }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </motion.div>

            {/* Password strength */}
            <AnimatePresence>
              {strength && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-1"
                >
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-4)" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: strength.width }}
                      transition={{ duration: 0.4 }}
                      className="h-full rounded-full"
                      style={{ background: strength.color }}
                    />
                  </div>
                  <p className="text-xs mt-1" style={{ color: strength.color }}>
                    {strength.label} password
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {err && (
              <motion.p
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-red-400 px-1"
              >
                {errMsg}
              </motion.p>
            )}

            {/* Submit */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
              <button
                type="submit"
                disabled={loading}
                className="auth-btn-primary mt-1"
                id="register-submit"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating account…
                  </span>
                ) : (
                  "Create account"
                )}
              </button>
            </motion.div>
          </form>

          {/* Divider */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6} className="auth-divider my-5">
            <span>or continue with</span>
          </motion.div>

          {/* Google */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7}>
            <button
              onClick={handleGoogleSignUp}
              disabled={googleLoading}
              className="auth-btn-google"
              id="register-google"
            >
              {googleLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 488 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" fill="#4285F4"/>
                </svg>
              )}
              Continue with Google
            </button>
          </motion.div>

          {/* Footer */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={8}
            className="text-center text-sm mt-6"
            style={{ color: "var(--text-muted)" }}
          >
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold transition-colors duration-200 hover:underline"
              style={{ color: "var(--primary-light)" }}
            >
              Sign in
            </Link>
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
};

export default Register;
