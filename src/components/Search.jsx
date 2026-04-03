import React, { useContext, useState, useEffect } from "react";
import {
  collection,
  query,
  getDocs,
  setDoc,
  doc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { Search as SearchIcon, UserPlus, Loader2, X } from "lucide-react";
import { db } from "../firebase";
import { AuthContext } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "./Avatar";

const Search = () => {
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);

  const { currentUser } = useContext(AuthContext);

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
          if (
            userData.displayName.toLowerCase().includes(username.toLowerCase()) &&
            userData.uid !== currentUser.uid
          ) {
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
  }, [username, currentUser.uid]);

  const handleSelect = async (selectedUser) => {
    try {
      const combinedId =
        currentUser.uid > selectedUser.uid
          ? currentUser.uid + selectedUser.uid
          : selectedUser.uid + currentUser.uid;

      const chatDoc = await getDoc(doc(db, "chats", combinedId));

      if (!chatDoc.exists()) {
        await setDoc(doc(db, "chats", combinedId), { messages: [] });

        await updateDoc(doc(db, "userChats", currentUser.uid), {
          [combinedId + ".userInfo"]: {
            uid: selectedUser.uid,
            displayName: selectedUser.displayName,
            photoURL: selectedUser.photoURL,
          },
          [combinedId + ".date"]: serverTimestamp(),
        });

        await updateDoc(doc(db, "userChats", selectedUser.uid), {
          [combinedId + ".userInfo"]: {
            uid: currentUser.uid,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
          },
          [combinedId + ".date"]: serverTimestamp(),
        });
      }

      setUsers([]);
      setUsername("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="px-3 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
      {/* Search input */}
      <div className="relative">
        <SearchIcon
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          type="text"
          placeholder="Search people…"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="search-input"
          id="search-users"
        />
        {username && (
          <button
            onClick={() => { setUsername(""); setUsers([]); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex justify-center py-3"
          >
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--primary-light)" }} />
          </motion.div>
        )}

        {err && username && !loading && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-xs text-center py-3"
            style={{ color: "var(--text-muted)" }}
          >
            No users found for "{username}"
          </motion.p>
        )}

        {users.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 space-y-1"
          >
            {users.map((user) => (
              <motion.li
                key={user.uid}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => handleSelect(user)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group"
                style={{ background: "var(--surface-3)" }}
                whileHover={{ backgroundColor: "rgba(99,102,241,0.12)" }}
              >
                <Avatar
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
                  style={{ border: "1.5px solid rgba(99,102,241,0.3)" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {user.displayName}
                  </p>
                  {user.bio && (
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {user.bio}
                    </p>
                  )}
                </div>
                <UserPlus size={15} style={{ color: "var(--primary-light)" }} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Search;
