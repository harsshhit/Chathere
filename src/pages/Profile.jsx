import React, { useContext, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import { motion } from "framer-motion";
import { Mail, Calendar, Clock, Edit2 } from "lucide-react";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";

const Profile = () => {
  const { currentUser } = useContext(AuthContext);
  const fileInputRef = useRef(null);

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const storage = getStorage();
      const storageRef = ref(storage, `profile_pictures/${currentUser.uid}`);
      
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          // Handle progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log('Upload is ' + progress + '% done');
        },
        (error) => {
          // Handle error
          console.error("Error uploading image:", error);
        },
        async () => {
          // Upload completed successfully
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await updateProfile(currentUser, {
            photoURL: downloadURL
          });
          // Force refresh to show new image
          window.location.reload();
        }
      );
    } catch (error) {
      console.error("Error updating profile picture:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <Navbar />
      <div className="flex-1 py-12 px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Header/Banner Section */}
            <div className="h-32 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400"></div>
            
            {/* Profile Content */}
            <div className="relative px-6 pb-8">
              {/* Profile Picture */}
              <motion.div 
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="relative -mt-16 mb-8"
              >
                <img
                  src={currentUser.photoURL}
                  alt="Profile"
                  className="w-32 h-32 mx-auto rounded-full object-cover border-4 border-white shadow-xl
                    transform hover:scale-105 transition-transform duration-300"
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
                  className="absolute bottom-0 right-1/2 translate-x-12 translate-y-2 p-2 bg-purple-500 hover:bg-purple-600 
                    rounded-full text-white shadow-lg transition-all duration-300 hover:scale-110"
                >
                  <Edit2 size={16} />
                </button>
              </motion.div>

              {/* User Info */}
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  {currentUser.displayName}
                </h2>
                <div className="flex items-center justify-center space-x-2 text-gray-600">
                  <Mail size={16} />
                  <p>{currentUser.email}</p>
                </div>
              </div>

              {/* Account Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-purple-50 to-white p-6 rounded-2xl shadow-md"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <Calendar className="text-purple-500" />
                    <h3 className="text-lg font-semibold text-gray-700">Member Since</h3>
                  </div>
                  <p className="text-gray-600 pl-9">
                    {new Date(currentUser.metadata.creationTime).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </motion.div>

                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="bg-gradient-to-br from-blue-50 to-white p-6 rounded-2xl shadow-md"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <Clock className="text-blue-500" />
                    <h3 className="text-lg font-semibold text-gray-700">Last Active</h3>
                  </div>
                  <p className="text-gray-600 pl-9">
                    {new Date(currentUser.metadata.lastSignInTime).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;