import React, { useState } from "react";
import Add from "../img/addAvatar.png";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db, storage } from "../firebase";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getStorage,
} from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { useNavigate, Link } from "react-router-dom";

const Register = () => {
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const displayName = e.target[0].value;
    const email = e.target[1].value;
    const password = e.target[2].value;
    const file = e.target[3].files[0];

    try {
      setLoading(true);
      // Create user
      const res = await createUserWithEmailAndPassword(auth, email, password);

      // Create a unique image name
      const date = new Date().getTime();
      const fileName = `${displayName}-${date}`;

      // Upload the file to Firebase Storage
      const storageRef = ref(storage, fileName);
      const storageInstance = getStorage();
      const uploadTask = uploadBytesResumable(storageRef, file);
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
      console.log(error);
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="formContainer">
      <div className="formWrapper">
        <span className="logo">ChatHere</span>
        <span className="title">Register</span>
        <form onSubmit={handleSubmit}>
          <input required type="text" placeholder="display name" />
          <input required type="email" placeholder="email" />
          <input required type="password" placeholder="password" />
          <input
            required
            style={{ display: "none" }}
            type="file"
            id="file"
            accept="image/*"
          />
          <label htmlFor="file">
            <img src={Add} alt="" />
            <span>Add an avatar</span>
          </label>
          <button disabled={loading}>Sign up</button>
          {loading && "Uploading and compressing the image, please wait..."}
          {err && <span>Something went wrong</span>}
        </form>
        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
