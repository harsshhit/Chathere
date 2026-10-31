import React, { memo, useCallback, useContext, useDeferredValue, useState, useEffect, useRef } from "react";
import {
  collection,
  query,
  getDocs,
  where,
  limit,
} from "firebase/firestore";
import { Search as SearchIcon, UserPlus, Loader2, X } from "lucide-react";
import { db } from "../firebase";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContexts";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Avatar from "./Avatar";
import { normalizeSearchText } from "../utils/searchableName";

const SearchResult = memo(function SearchResult({ user, onSelect }) {
  return <motion.li
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    className="search-result"
  >
    <button type="button" onClick={() => onSelect(user)} className="search-result-button">
      <Avatar
        src={user.photoURL}
        alt={user.displayName}
        className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
        style={{ border: "1px solid var(--border-strong)" }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">
          {user.displayName}
        </span>
        {user.bio && <span className="block truncate text-xs text-[var(--text-muted)]">{user.bio}</span>}
      </span>
      <UserPlus size={17} className="flex-shrink-0 text-[var(--primary-text)]" />
    </button>
  </motion.li>;
});

const getUserSearchResults = async (searchTerm, currentUserId) => {
  const safeTerm = normalizeSearchText(searchTerm);
  if (!safeTerm || !currentUserId) return [];

  const searchQuery = query(
    collection(db, "users"),
    where("displayNameLower", ">=", safeTerm),
    where("displayNameLower", "<=", `${safeTerm}\uf8ff`),
    limit(25)
  );

  const snapshot = await getDocs(searchQuery);
  return snapshot.docs
    .map((userDoc) => userDoc.data())
    .filter((userData) => userData?.uid && userData.uid !== currentUserId)
    .slice(0, 25);
};

const Search = ({ isOpen = true, onClose }) => {
  const [username, setUsername] = useState("");
  const [users, setUsers] = useState([]);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const deferredUsername = useDeferredValue(username);

  const { currentUser } = useContext(AuthContext);
  const { dispatch } = useContext(ChatContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    let active = true;
    const searchUsers = async () => {
      const searchTerm = normalizeSearchText(deferredUsername);
      if (!searchTerm || !currentUser?.uid) {
        setUsers([]);
        setErr(false);
        setLoading(false);
        return undefined;
      }

      setLoading(true);
      try {
        const searchResults = await getUserSearchResults(searchTerm, currentUser.uid);

        if (!active) return;
        setUsers(searchResults);
        setErr(searchResults.length === 0);
        setLoading(false);
      } catch (err) {
        if (!active) return;
        console.error(err);
        setErr(true);
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 250);

    return () => {
      active = false;
      clearTimeout(debounceTimer);
    };
  }, [deferredUsername, currentUser?.uid]);

  const handleSelect = useCallback((selectedUser) => {
    dispatch({ type: "CHANGE_USER", payload: selectedUser });
    // Derive the same chatId the reducer would compute
    const derivedChatId = selectedUser.isGroup
      ? selectedUser.uid
      : currentUser.uid > selectedUser.uid
      ? currentUser.uid + selectedUser.uid
      : selectedUser.uid + currentUser.uid;
    navigate(`/chat/${derivedChatId}`);
    setUsers([]);
    setUsername("");
  }, [currentUser.uid, dispatch, navigate]);

  return (
    <div className="px-4 pb-3 pt-1">
      <div className="relative">
        <SearchIcon
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search people…"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="search-input glass"
          aria-label="Search people"
          id="search-users"
        />
        {username && (
          <button
            onClick={() => { setUsername(""); setUsers([]); }}
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
            aria-label="Clear search"
            style={{ color: "var(--text-muted)" }}
          >
            <X size={14} />
          </button>
        )}
        {onClose && !username && (
          <button
            type="button"
            onClick={() => { inputRef.current?.blur(); onClose(); }}
            className="search-close-button absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            aria-label="Close search"
          >
            <X size={15} />
          </button>
        )}
      </div>

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
            {users.map((user) => <SearchResult key={user.uid} user={user} onSelect={handleSelect} />)}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Search;
