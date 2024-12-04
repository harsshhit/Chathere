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
    <div className="p-6 bg-gradient-to-br from-white to-blue-50 border-b border-blue-100 shadow-sm">
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <SearchIcon className="text-blue-400 w-6 h-6" />
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
          className="w-full pl-12 pr-6 py-3.5 border-2 border-blue-200 rounded-full focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition duration-300 text-lg font-medium placeholder:text-blue-300 shadow-sm hover:shadow-md"
        />
      </div>

      {err && (
        <div className="text-red-500 text-center mb-6 animate-pulse font-semibold bg-red-50 py-3 rounded-full border border-red-200">
          User not found! Try a different name.
        </div>
      )}

      {user && (
        <div
          onClick={handleSelect}
          className="flex items-center p-4 bg-white rounded-2xl cursor-pointer hover:bg-blue-50 transition duration-300 group border-2 border-blue-100 hover:border-blue-300 shadow-sm hover:shadow-md"
        >
          <img
            src={user.photoURL}
            alt={user.displayName}
            className="w-14 h-14 rounded-full object-cover mr-4 border-4 border-blue-200 group-hover:border-blue-300 group-hover:scale-105 transition duration-300 shadow-md"
          />
          <div className="flex-grow">
            <span className="font-bold text-xl text-gray-800 group-hover:text-blue-700 transition duration-300">
              {user.displayName}
            </span>
          </div>
          <User className="text-blue-500 w-6 h-6 group-hover:translate-x-1 transition duration-300" />
        </div>
      )}
    </div>
  );
};

export default Search;
