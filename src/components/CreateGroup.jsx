import React, { useState, useContext, useEffect } from "react";
import { X, Check, Users, Search as SearchIcon, Loader2, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { collection, query, getDocs, setDoc, doc, serverTimestamp, where, limit } from "firebase/firestore";
import { db } from "../firebase";
import { AuthContext } from "../context/AuthContext";
import { v4 as uuid } from "uuid";
import Avatar from "./Avatar";
import { uploadImage } from "../utils/cloudinary";
import LazyImage from "./ui/LazyImage";
import { ScrollRootProvider } from "../context/ScrollRootContext";
import { normalizeSearchText } from "../utils/searchableName";

const CreateGroup = ({ onClose }) => {
  const { currentUser } = useContext(AuthContext);
  const [groupName, setGroupName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [groupPhotoUrl, setGroupPhotoUrl] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [photoError, setPhotoError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [groupError, setGroupError] = useState("");
  const photoInputRef = React.useRef(null);
  const memberListRef = React.useRef(null);
  const creatingRef = React.useRef(false);

  useEffect(() => () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
  }, [photoPreviewUrl]);

  useEffect(() => {
    let active = true;
    const searchUsers = async () => {
      const normalizedTerm = normalizeSearchText(searchTerm);
      if (!normalizedTerm || !currentUser?.uid) {
        setUsers([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const q = query(
          collection(db, "users"),
          where("displayNameLower", ">=", normalizedTerm),
          where("displayNameLower", "<=", `${normalizedTerm}\uf8ff`),
          limit(25)
        );
        const snapshot = await getDocs(q);
        if (!active) return;
        const results = snapshot.docs
          .map((userDoc) => userDoc.data())
          .filter((data) => data?.uid && data.uid !== currentUser.uid)
          .slice(0, 25);
        setUsers(results);
      } catch (err) {
        if (active) console.error("Could not search users for group members:", err);
      }
      if (active) setLoading(false);
    };

    const timer = setTimeout(() => searchUsers(), 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm, currentUser.uid]);

  const toggleUser = (user) => {
    if (selectedUsers.find((u) => u.uid === user.uid)) {
      setSelectedUsers(selectedUsers.filter((u) => u.uid !== user.uid));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleGroupPhotoSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setGroupPhoto(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setPhotoError("");
    setUploadingPhoto(true);
    setUploadProgress(0);
    try {
      const url = await uploadImage(file, { folder: "chathere/groups", onProgress: setUploadProgress });
      setGroupPhotoUrl(url);
      setPhotoPreviewUrl(url);
    } catch (error) {
      setGroupPhotoUrl("");
      setPhotoError(error.message || "Group photo upload failed. Please retry.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const retryGroupPhotoUpload = async () => {
    if (!groupPhoto || uploadingPhoto) return;
    setUploadingPhoto(true);
    setUploadProgress(0);
    setPhotoError("");
    try {
      const url = await uploadImage(groupPhoto, { folder: "chathere/groups", onProgress: setUploadProgress });
      setGroupPhotoUrl(url);
      setPhotoPreviewUrl(url);
    } catch (error) {
      setPhotoError(error.message || "Group photo upload failed. Please retry.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCreateGroup = async () => {
    if (creatingRef.current || !groupName.trim() || selectedUsers.length === 0) return;
    creatingRef.current = true;
    setCreating(true);
    setGroupError("");

    try {
      const groupId = `group_${uuid()}`;
      const groupMembers = [
        {
          uid: currentUser.uid,
          ...(currentUser.displayName ? { displayName: currentUser.displayName } : {}),
          ...(currentUser.photoURL ? { photoURL: currentUser.photoURL } : {}),
        },
        ...selectedUsers.map((user) => ({
          uid: user.uid,
          ...(user.displayName ? { displayName: user.displayName } : {}),
          ...(user.photoURL ? { photoURL: user.photoURL } : {}),
        })),
      ];

      await setDoc(doc(db, "chats", groupId), { messages: [] });

      const groupData = {
        uid: groupId,
        displayName: groupName,
        photoURL: groupPhotoUrl || `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(groupName)}`,
        isGroup: true,
        members: groupMembers,
        admin: currentUser.uid,
      };

      for (const member of groupMembers) {
        await setDoc(
          doc(db, "userChats", member.uid),
          {
            [groupId]: {
              userInfo: groupData,
              date: serverTimestamp(),
            },
          },
          { merge: true }
        );
      }

      onClose();
    } catch (err) {
      console.error("Could not create group:", err);
      setGroupError("Could not create the group. Please try again.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-overlay"
      style={{ background: "var(--overlay)" }}
      onClick={onClose}
    >
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
            <Users size={20} className="text-[var(--primary-text)]" /> New Group
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--hover)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {groupError && <p role="alert" className="text-sm text-[var(--danger-text)]">{groupError}</p>}

        <div>
          <label htmlFor="group-name" className="block text-[10px] uppercase text-[var(--text-muted)] mb-1.5 font-bold tracking-wider">Group Name</label>
          <input 
            id="group-name"
            type="text" 
            placeholder="E.g., Weekend Plans" 
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            style={{ background: "var(--surface-3)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            autoFocus
          />
        </div>

        <div className="flex items-center gap-3">
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handleGroupPhotoSelect} />
          <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
            {uploadingPhoto ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploadingPhoto ? `Uploading ${uploadProgress}%` : "Group photo"}
          </button>
          {photoPreviewUrl && <LazyImage src={photoPreviewUrl} alt="Group" width={40} height={40} className="h-10 w-10 rounded-lg" />}
          {photoError && <div className="min-w-0 flex-1 text-[11px] text-[var(--danger-text)]"><span className="block truncate">{photoError}</span><button type="button" onClick={retryGroupPhotoUpload} disabled={uploadingPhoto} className="font-semibold underline disabled:opacity-50">Retry</button></div>}
        </div>

        <div>
          <label htmlFor="group-member-search" className="block text-[10px] uppercase text-[var(--text-muted)] mb-1.5 font-bold tracking-wider">Add Members ({selectedUsers.length})</label>
          <div className="relative mb-3">
             <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
             <input 
               id="group-member-search"
               type="text"
               placeholder="Search users..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full pl-9 pr-3 py-2 rounded-xl outline-none text-sm focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
               style={{ background: "var(--surface-3)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
             />
          </div>

          <div ref={memberListRef} className="flex-1 h-[180px] overflow-y-auto mb-2 custom-scrollbar pr-1">
            <ScrollRootProvider rootRef={memberListRef}>
            {loading ? (
               <div className="h-full flex items-center justify-center">
                 <Loader2 className="animate-spin text-[var(--primary-text)]" size={20} />
               </div>
            ) : users.length > 0 ? (
               <div className="space-y-1">
                 {users.map((user) => {
                   const isSelected = selectedUsers.some(u => u.uid === user.uid);
                   return (
                     <div 
                       key={user.uid} 
                       onClick={() => toggleUser(user)}
                       className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors hover:bg-[var(--hover)]"
                       style={{ background: isSelected ? "var(--primary-soft)" : "transparent" }}
                     >
                       <Avatar src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full" />
                       <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">{user.displayName}</span>
                       <div className="w-5 h-5 rounded border flex items-center justify-center transition-colors" style={{ background: isSelected ? "var(--primary)" : "transparent", borderColor: isSelected ? "var(--primary)" : "var(--border-light)" }}>
                         {isSelected && <Check size={12} className="text-white" />}
                       </div>
                     </div>
                   );
                 })}
               </div>
            ) : searchTerm ? (
               <p className="text-center text-xs text-[var(--text-muted)] mt-6">No users found</p>
            ) : (
               <p className="text-center text-xs text-[var(--text-muted)] mt-6">Search to add members</p>
            )}
            </ScrollRootProvider>
          </div>
        </div>

        <button 
          onClick={handleCreateGroup}
          disabled={creating || uploadingPhoto || (groupPhoto && !groupPhotoUrl) || !groupName.trim() || selectedUsers.length === 0}
          className="w-full py-3 mt-2 rounded-xl text-sm font-bold flex items-center justify-center transition-all disabled:opacity-50 hover:shadow-[0_4px_16px_var(--primary-glow)] disabled:shadow-none"
          style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)", color: "white" }}
        >
          {creating ? <Loader2 size={16} className="animate-spin" /> : "Create Group"}
        </button>
      </motion.div>
    </div>
  );
};

export default CreateGroup;
