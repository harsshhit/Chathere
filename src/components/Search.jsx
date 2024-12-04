import React, { useContext, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { Search as SearchIcon, User } from "lucide-react";
import { db } from "../firebase";
import { AuthContext } from "../context/AuthContext";

const Search = () => {
  const [username, setUsername] = useState("");
  const [user, setUser] = useState(null);
  const [err, setErr] = useState(false);

  const { currentUser } = useContext(AuthContext);

  const handleSearch = async () => {
    const q = query(
      collection(db, "users"),
      where("displayName", "==", username)
    );

    try {
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        setErr(true);
        setUser(null);
      } else {
        querySnapshot.forEach((doc) => {
          setUser(doc.data());
          setErr(false);
        });
      }
    } catch (err) {
      setErr(true);
    }
  };

  const handleKey = (e) => {
    e.code === "Enter" && handleSearch();
  };

  const handleSelect = async () => {
    const combinedId =
      currentUser.uid > user.uid
        ? currentUser.uid + user.uid
        : user.uid + currentUser.uid;
    try {
      const res = await getDoc(doc(db, "chats", combinedId));

      if (!res.exists()) {
        await setDoc(doc(db, "chats", combinedId), { messages: [] });

        await updateDoc(doc(db, "userChats", currentUser.uid), {
          [combinedId + ".userInfo"]: {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL,
          },
          [combinedId + ".date"]: serverTimestamp(),
        });

        await updateDoc(doc(db, "userChats", user.uid), {
          [combinedId + ".userInfo"]: {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
          },
          [combinedId + ".date"]: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error("Error selecting user:", err);
    }

    setUser(null);
    setUsername("");
  };

  return (
    <div className="p-4 bg-white border-b border-gray-200">
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="text-gray-400 w-5 h-5" />
        </div>
        <input
          type="text"
          placeholder="Search for a user... (e.g., Harshit)"
          onKeyDown={handleKey}
          onChange={(e) => {
            setUsername(e.target.value);
            setErr(false);
          }}
          value={username}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition duration-300"
        />
      </div>

      {err && (
        <div className="text-red-500 text-center mb-4 animate-pulse">
          User not found! Try a different name.
        </div>
      )}

      {user && (
        <div
          onClick={handleSelect}
          className="flex items-center p-3 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 transition duration-300 group"
        >
          <img
            src={user.photoURL}
            alt={user.displayName}
            className="w-12 h-12 rounded-full object-cover mr-4 border-2 border-purple-200 group-hover:scale-105 transition duration-300"
          />
          <div className="flex-grow">
            <span className="font-semibold text-gray-800 group-hover:text-purple-700 transition duration-300">
              {user.displayName}
            </span>
          </div>
          <User className="text-purple-500 group-hover:translate-x-1 transition duration-300" />
        </div>
      )}
    </div>
  );
};

export default Search;
