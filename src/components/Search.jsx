import React, { useContext, useState, useEffect } from "react";
import {
  collection,
  query,
  // where,
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
  // const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);

  const { currentUser } = useContext(AuthContext);

  // Search users whenever username changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!username.trim()) {
        setUsers([]);
        setErr(false);
        return;
      }

      setLoading(true);
      try {
        const usersRef = collection(db, "users");
        const q = query(usersRef);
        const querySnapshot = await getDocs(q);
        
        const searchResults = [];
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          // Case insensitive search on displayName
          if (userData.displayName.toLowerCase().includes(username.toLowerCase())) {
            searchResults.push(userData);
          }
        });

        setUsers(searchResults);
        setErr(searchResults.length === 0);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setErr(true);
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      searchUsers();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [username]);

  const handleSelect = async (selectedUser) => {
    try {
      const combinedId = 
        currentUser.uid > selectedUser.uid 
          ? currentUser.uid + selectedUser.uid 
          : selectedUser.uid + currentUser.uid;

      // Check if chat exists
      const chatDoc = await getDoc(doc(db, "chats", combinedId));

      if (!chatDoc.exists()) {
        // Create chat document in chats collection
        await setDoc(doc(db, "chats", combinedId), {
          messages: []
        });

        // Update userChats for both users
        const userChatsRef = doc(db, "userChats", currentUser.uid);
        const otherUserChatsRef = doc(db, "userChats", selectedUser.uid);

        await updateDoc(userChatsRef, {
          [combinedId + ".userInfo"]: {
            uid: selectedUser.uid,
            displayName: selectedUser.displayName,
            photoURL: selectedUser.photoURL
          },
          [combinedId + ".date"]: serverTimestamp()
        });

        await updateDoc(otherUserChatsRef, {
          [combinedId + ".userInfo"]: {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL
          },
          [combinedId + ".date"]: serverTimestamp()
        });
      }

      // Reset search state
      setUsers([]);
      setUsername("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-3 border-b border-blue-100 shadow-sm">
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <SearchIcon className="text-blue-400 w-5 h-5" />
        </div>
        <input
          type="text"
          placeholder="Search users by name..."
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full pl-12 pr-6 py-3 border-2 border-blue-200 rounded-full focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition duration-300 text-lg font-medium placeholder:text-blue-300 shadow-sm hover:shadow-md"
        />
      </div>

      {loading && (
        <div className="text-center py-4 text-blue-500">
          Searching...
        </div>
      )}

      {err && username && !loading && (
        <div className="text-red-500 text-center mb-4 animate-pulse font-semibold bg-red-50 py-3 rounded-full border border-red-200">
          No users found matching "{username}"
        </div>
      )}

      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.uid}
            onClick={() => handleSelect(user)}
            className="flex items-center p-4 bg-white rounded-2xl cursor-pointer hover:bg-blue-50 transition duration-300 group border-2 border-blue-100 hover:border-blue-300 shadow-sm hover:shadow-md"
          >
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="w-12 h-12 rounded-full object-cover mr-4 border-4 border-blue-200 group-hover:border-blue-300 group-hover:scale-105 transition duration-300 shadow-md"
            />
            <div className="flex-grow">
              <span className="font-bold text-lg text-gray-800 group-hover:text-blue-700 transition duration-300">
                {user.displayName}
              </span>
            </div>
            <User className="text-blue-500 w-5 h-5 group-hover:translate-x-1 transition duration-300" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Search;
