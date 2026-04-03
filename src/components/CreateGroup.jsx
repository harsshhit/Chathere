import React, { useState, useContext, useEffect } from "react";
import { X, Check, Users, Search as SearchIcon, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { collection, query, getDocs, setDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { AuthContext } from "../context/AuthContext";
import { v4 as uuid } from "uuid";
import Avatar from "./Avatar";

const CreateGroup = ({ onClose }) => {
  const { currentUser } = useContext(AuthContext);
  const [groupName, setGroupName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchTerm.trim()) {
        setUsers([]);
        return;
      }
      setLoading(true);
      try {
        const q = query(collection(db, "users"));
        const snapshot = await getDocs(q);
        const results = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (
            data.displayName.toLowerCase().includes(searchTerm.toLowerCase()) &&
            data.uid !== currentUser.uid
          ) {
            results.push(data);
          }
        });
        setUsers(results);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };

    const timer = setTimeout(() => searchUsers(), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, currentUser.uid]);

  const toggleUser = (user) => {
    if (selectedUsers.find((u) => u.uid === user.uid)) {
      setSelectedUsers(selectedUsers.filter((u) => u.uid !== user.uid));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    setCreating(true);

    try {
      const groupId = `group_${uuid()}`;
      const groupMembers = [
        { uid: currentUser.uid, displayName: currentUser.displayName, photoURL: currentUser.photoURL },
        ...selectedUsers.map(u => ({ uid: u.uid, displayName: u.displayName, photoURL: u.photoURL }))
      ];

      // 1. Create chat document
      await setDoc(doc(db, "chats", groupId), { messages: [] });

      // 2. Add to each member's userChats
      const groupData = {
        uid: groupId,
        displayName: groupName,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=random`,
        isGroup: true,
        members: groupMembers,
        admin: currentUser.uid,
      };

      for (let member of groupMembers) {
        await updateDoc(doc(db, "userChats", member.uid), {
          [`${groupId}.userInfo`]: groupData,
          [`${groupId}.date`]: serverTimestamp(),
        }).catch(async () => {
          await setDoc(doc(db, "userChats", member.uid), {
            [`${groupId}`]: {
               userInfo: groupData,
               date: serverTimestamp()
            }
          });
        });
      }

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Users size={20} className="text-indigo-400" /> New Group
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-[10px] uppercase text-gray-400 mb-1.5 font-bold tracking-wider">Group Name</label>
          <input 
            type="text" 
            placeholder="E.g., Weekend Plans" 
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none"
            style={{ background: "var(--surface-3)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-[10px] uppercase text-gray-400 mb-1.5 font-bold tracking-wider">Add Members ({selectedUsers.length})</label>
          <div className="relative mb-3">
             <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
             <input 
               type="text"
               placeholder="Search users..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-3 py-2 rounded-xl outline-none text-sm"
               style={{ background: "var(--surface-3)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
             />
          </div>

          <div className="flex-1 h-[180px] overflow-y-auto mb-2 custom-scrollbar pr-1">
            {loading ? (
               <div className="h-full flex items-center justify-center">
                 <Loader2 className="animate-spin text-indigo-400" size={20} />
               </div>
            ) : users.length > 0 ? (
               <div className="space-y-1">
                 {users.map((user) => {
                   const isSelected = selectedUsers.some(u => u.uid === user.uid);
                   return (
                     <div 
                       key={user.uid} 
                       onClick={() => toggleUser(user)}
                       className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors hover:bg-white/5"
                       style={{ background: isSelected ? "rgba(99,102,241,0.15)" : "transparent" }}
                     >
                       <Avatar src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full" />
                       <span className="flex-1 text-sm font-medium">{user.displayName}</span>
                       <div className="w-5 h-5 rounded border border-gray-600 flex items-center justify-center transition-colors" style={{ background: isSelected ? "var(--primary)" : "transparent", borderColor: isSelected ? "var(--primary)" : "var(--border)" }}>
                         {isSelected && <Check size={12} className="text-white" />}
                       </div>
                     </div>
                   );
                 })}
               </div>
            ) : searchTerm ? (
               <p className="text-center text-xs text-gray-500 mt-6">No users found</p>
            ) : (
               <p className="text-center text-xs text-gray-500 mt-6">Search to add members</p>
            )}
          </div>
        </div>

        <button 
          onClick={handleCreateGroup}
          disabled={creating || !groupName.trim() || selectedUsers.length === 0}
          className="w-full py-3 mt-2 rounded-xl text-sm font-bold flex items-center justify-center transition-all disabled:opacity-50 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)] disabled:shadow-none"
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)", color: "white" }}
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : "Create Group"}
        </button>
      </motion.div>
    </div>
  );
};

export default CreateGroup;
