import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const Login = () => {
  const [err, setErr] = useState(false);
  const [errMsg, setErrMsg] = useState("Something went wrong. Please try again.");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setErr(false);
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      setErr(true);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setErrMsg("Invalid email or password.");
      } else if (err.code === "auth/user-not-found") {
        setErrMsg("No account found with this email.");
      } else {
        setErrMsg("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      setErr(false);
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        });
        await setDoc(doc(db, "userChats", user.uid), {});
      }
      navigate("/");
    } catch (error) {
      setErr(true);
      setErrMsg("Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.45, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  return (
    <div className="auth-bg min-h-screen flex items-center justify-center p-4 sm:p-6">
      {/* Decorative orb top right */}
      <div
        className="pointer-events-none fixed top-0 right-0 w-[520px] h-[520px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
          filter: "blur(60px)",
          transform: "translate(40%, -40%)",
        }}
      />
      {/* Decorative orb bottom left */}
      <div
        className="pointer-events-none fixed bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-15"
        style={{
          background: "radial-gradient(circle, #a78bfa 0%, transparent 70%)",
          filter: "blur(60px)",
          transform: "translate(-30%, 30%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="glass-card p-8 sm:p-10">
          {/* Logo + Header */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0}
            className="mb-8 text-center"
          >
            <h1 className="brand-logo text-4xl mb-1.5">Quawk</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Welcome back — sign in to continue
            </p>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="relative">
              <Mail
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                required
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                id="login-email"
              />
            </motion.div>

            {/* Password */}
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="relative">
              <Lock
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                required
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input pr-10"
                id="login-password"
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
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
              <button
                type="submit"
                disabled={loading}
                className="auth-btn-primary mt-1"
                id="login-submit"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </motion.div>
          </form>

          {/* Divider */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4} className="auth-divider my-5">
            <span>or continue with</span>
          </motion.div>

          {/* Google */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            <button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="auth-btn-google"
              id="login-google"
            >
              {googleLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 488 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" fill="#4285F4"/>
                  <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256" fill="#34A853" opacity="0"/>
                </svg>
              )}
              Continue with Google
            </button>
          </motion.div>

          {/* Footer link */}
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={6}
            className="text-center text-sm mt-6"
            style={{ color: "var(--text-muted)" }}
          >
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-semibold transition-colors duration-200 hover:underline"
              style={{ color: "var(--primary-light)" }}
            >
              Create one
            </Link>
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
