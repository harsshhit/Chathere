import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db, storage } from "../firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  // getStorage,
} from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { User, Mail, Lock, ImagePlus } from "lucide-react";

const Register = () => {
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!avatar) {
      alert("Please select an avatar");
      return;
    }

    try {
      setLoading(true);
      // Create user
      const res = await createUserWithEmailAndPassword(auth, email, password);

      // Create a unique image name
      const date = new Date().getTime();
      const fileName = `${displayName}-${date}`;

      // Upload the file to Firebase Storage
      const storageRef = ref(storage, fileName);
      // const storageInstance = getStorage();
      const uploadTask = uploadBytesResumable(storageRef, avatar);
      await new Promise((resolve, reject) => {
        uploadTask.on("state_changed", null, reject, () => {
          // Get the download URL
          getDownloadURL(storageRef)
            .then(async (downloadURL) => {
              // Update user profile
              await updateProfile(res.user, {
                displayName,
                photoURL: downloadURL,
              });

              // Create user document in Firestore
              await setDoc(doc(db, "users", res.user.uid), {
                uid: res.user.uid,
                displayName,
                email,
                photoURL: downloadURL,
              });

              // Create empty user chats in Firestore
              await setDoc(doc(db, "userChats", res.user.uid), {});

              resolve();
            })
            .catch(reject);
        });
      });

      navigate("/");
    } catch (error) {
      console.error(error);
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    setAvatar(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-purple-300 flex items-center justify-center p-4">
      <div className="bg-white shadow-2xl rounded-2xl w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-purple-600 mb-2">ChatHere</h1>
          <p className="text-gray-500">Create Your Account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              required
              type="text"
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-300"
            />
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-300"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              required
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-300"
            />
          </div>

          <div className="relative">
            <input
              required
              type="file"
              id="avatar"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
            <label
              htmlFor="avatar"
              className="flex items-center justify-center w-full py-3 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-purple-50 transition duration-300"
            >
              <ImagePlus className="mr-2 text-gray-400" />
              <span className="text-gray-600">
                {avatar ? avatar.name : "Add an avatar"}
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition duration-300 transform hover:scale-105 active:scale-95 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing Up..." : "Sign Up"}
          </button>

          {err && (
            <p className="text-red-500 text-center animate-pulse">
              Something went wrong. Please try again.
            </p>
          )}
        </form>

        <div className="text-center">
          <p className="text-gray-600">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-purple-600 hover:underline font-semibold"
            >
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
