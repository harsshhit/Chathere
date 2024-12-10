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
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 border-b border-blue-100 shadow-sm">
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
        <div className="text-center py-2 text-blue-500">Searching...</div>
      )}

      {err && username && !loading && (
        <div className="text-red-500 text-center py-2">
          No users found matching "{username}"
        </div>
      )}

      <ul className="divide-y divide-gray-100">
        {users.map((user) => (
          <li
            key={user.uid}
            onClick={() => handleSelect(user)}
            className="flex items-center py-2 px-1 hover:bg-gray-50 cursor-pointer"
          >
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="w-8 h-8 rounded-full object-cover mr-3"
            />
            <div className="flex-grow">
              <span className="text-gray-700">{user.displayName}</span>
              {user.bio && (
                <p className="text-sm text-gray-500 mt-0.5">Bio: {user.bio}</p>
              )}
            </div>
            <User className="text-gray-400 w-4 h-4" />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Search;
