import React, { useContext, useRef, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { motion } from "framer-motion";
import { Mail, Calendar, Edit2 } from "lucide-react";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const Profile = () => {
  const { currentUser } = useContext(AuthContext);
  const fileInputRef = useRef(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState(currentUser.displayName);
  const [bio, setBio] = useState("");
  const [newBio, setNewBio] = useState("");

  useEffect(() => {
    const fetchBio = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setBio(userData.bio || "");
          setNewBio(userData.bio || "");
        }
      } catch (error) {
        console.error("Error fetching bio:", error);
      }
    };
    fetchBio();
  }, [currentUser.uid]);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const storage = getStorage();
      const storageRef = ref(storage, `profile_pictures/${currentUser.uid}`);

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Handle progress
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log("Upload is " + progress + "% done");
        },
        (error) => {
          // Handle error
          console.error("Error uploading image:", error);
        },
        async () => {
          // Upload completed successfully
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await updateProfile(currentUser, {
            photoURL: downloadURL,
          });
          // Force refresh to show new image
          window.location.reload();
        }
      );
    } catch (error) {
      console.error("Error updating profile picture:", error);
    }
  };

  const handleNameUpdate = async () => {
    try {
      // Update auth profile
      await updateProfile(currentUser, {
        displayName: newDisplayName,
      });

      // Update in firestore users collection
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        displayName: newDisplayName,
      });

      setIsEditingName(false);
      // Force refresh to show new name
      window.location.reload();
    } catch (error) {
      console.error("Error updating display name:", error);
    }
  };

  const handleBioUpdate = async () => {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        bio: newBio,
      });
      setBio(newBio);
      setIsEditingBio(false);
    } catch (error) {
      console.error("Error updating bio:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <div className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-white rounded-lg shadow-sm p-8">
            {/* Profile Picture */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative mb-8"
            >
              <img
                src={currentUser.photoURL}
                alt="Profile"
                className="w-24 h-24 mx-auto rounded-full object-cover border-2 border-gray-100"
              />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current.click()}
                className="absolute bottom-0 right-1/2 translate-x-8 translate-y-2 p-1.5 bg-gray-700 hover:bg-gray-800 
                  rounded-full text-white shadow-sm transition-colors duration-200"
              >
                <Edit2 size={14} />
              </button>
            </motion.div>

            {/* User Info */}
            <div className="space-y-6">
              <div className="text-center">
                {isEditingName ? (
                  <div className="flex items-center justify-center space-x-2">
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      className="text-lg px-3 py-1 border border-gray-300 rounded focus:outline-none focus:border-gray-500"
                    />
                    <button
                      onClick={handleNameUpdate}
                      className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors duration-200"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <h2 className="text-xl font-medium text-gray-900">
                      {currentUser.displayName}
                    </h2>
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-1 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-center space-x-2 text-gray-500 mt-2">
                  <Mail size={14} />
                  <p className="text-sm">{currentUser.email}</p>
                </div>
              </div>

              {/* Bio Section */}
              <div className="text-center">
                {isEditingBio ? (
                  <div className="space-y-2">
                    <textarea
                      value={newBio}
                      onChange={(e) => setNewBio(e.target.value)}
                      placeholder="Add your bio..."
                      className="w-full p-2 text-sm text-gray-700 border border-gray-300 rounded focus:outline-none focus:border-gray-500"
                      rows="3"
                    />
                    <button
                      onClick={handleBioUpdate}
                      className="px-3 py-1 bg-gray-700 text-white text-sm rounded hover:bg-gray-800 transition-colors duration-200"
                    >
                      Save Bio
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-2">
                    <p className="text-sm text-gray-500 italic">
                      {bio || "Add bio"}
                    </p>
                    <button
                      onClick={() => setIsEditingBio(true)}
                      className="p-1 text-gray-500 hover:text-gray-700 transition-colors duration-200"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Member Since */}
              <div className="text-center pt-4 border-t border-gray-100">
                <div className="flex items-center justify-center space-x-2 text-gray-500">
                  <Calendar size={14} />
                  <p className="text-sm">
                    Member since{" "}
                    {new Date(
                      currentUser.metadata.creationTime
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
