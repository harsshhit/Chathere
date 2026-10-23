import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Calendar, Check, Edit2, Info, LogOut, Mail, Settings, Archive } from "lucide-react";
import { updateProfile, signOut } from "firebase/auth";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { AuthContext } from "../context/AuthContext";
import { UserChatsContext, UserDocumentContext } from "../context/ChatContext";
import Avatar from "../components/Avatar";
import AvatarPicker from "../components/AvatarPicker";
import { SettingsGroup, SettingsRow, ScreenHeader, Section, StatCard, Sheet } from "../components/ui";
import { auth, db } from "../firebase";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const Profile = () => {
  const { currentUser, updateAuthUser } = useContext(AuthContext);
  const userChats = useContext(UserChatsContext);
  const userDocument = useContext(UserDocumentContext);
  const navigate = useNavigate();
  const location = useLocation();
  const editMode = location.pathname === "/profile/edit";
  const reduceMotion = useReducedMotion();
  const [nameDraft, setNameDraft] = useState(currentUser?.displayName || "");
  const [bioDraft, setBioDraft] = useState(userDocument.bio || "");
  const [bioTouched, setBioTouched] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const dirty = nameDraft.trim() !== (currentUser?.displayName || "") || bioDraft !== (userDocument.bio || "");

  useEffect(() => {
    setNameDraft(currentUser?.displayName || "");
  }, [currentUser?.uid, currentUser?.displayName]);

  useEffect(() => {
    if (!editMode || !bioTouched) setBioDraft(userDocument.bio || "");
  }, [userDocument.bio, editMode, bioTouched]);

  useEffect(() => {
    const onPopState = () => {
      if (editMode && dirty) {
        if (!window.confirm("Discard your unsaved profile changes?")) {
          navigate("/profile/edit", { replace: true });
        } else {
          setNameDraft(currentUser?.displayName || "");
          setBioDraft(userDocument.bio || "");
          setBioTouched(false);
        }
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [currentUser?.displayName, dirty, editMode, navigate, userDocument.bio]);

  const chatEntries = useMemo(() => Object.entries(userChats || {}).filter(([, entry]) => entry?.userInfo), [userChats]);
  const groupCount = chatEntries.filter(([, entry]) => entry.userInfo?.isGroup).length;
  const profileStats = chatEntries.length ? [
    { label: "Chats", value: chatEntries.length },
    { label: "Groups", value: groupCount },
  ] : [];
  const memberSince = currentUser?.metadata?.creationTime
    ? new Date(currentUser.metadata.creationTime).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "";

  const updateAvatar = async (photoURL) => {
    if (!auth.currentUser || !currentUser?.uid || !photoURL) return;
    await updateProfile(auth.currentUser, { photoURL });
    await updateDoc(doc(db, "users", currentUser.uid), { photoURL });
    try {
      const userChatsRef = doc(db, "userChats", currentUser.uid);
      const snapshot = await getDoc(userChatsRef);
      if (snapshot.exists()) {
        const updates = {};
        Object.entries(snapshot.data() || {}).forEach(([chatId, chatEntry]) => {
          if (chatEntry?.userInfo?.uid === currentUser.uid) updates[`${chatId}.userInfo.photoURL`] = photoURL;
        });
        if (Object.keys(updates).length) await updateDoc(userChatsRef, updates);
      }
    } catch (cause) {
      console.warn("Could not update userChats entry:", cause);
    }
    updateAuthUser?.({ photoURL });
  };

  const saveProfile = async () => {
    const displayName = nameDraft.trim();
    if (displayName.length < 2) {
      setError("Display name must be at least 2 characters.");
      return;
    }
    if (!auth.currentUser || !currentUser?.uid) return;
    setSaving(true);
    setError("");
    try {
      await updateProfile(auth.currentUser, { displayName });
      await updateDoc(doc(db, "users", currentUser.uid), { displayName, bio: bioDraft.trim() });
      updateAuthUser?.({ displayName });
      setBioTouched(false);
      if (location.state?.profileEdit && window.history.state?.idx > 0) navigate(-1);
      else navigate("/profile", { replace: true });
    } catch (cause) {
      console.error("Could not update profile:", cause);
      setError("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const closeEdit = useCallback(() => {
    if (dirty && !window.confirm("Discard your unsaved profile changes?")) return;
    setNameDraft(currentUser?.displayName || "");
    setBioDraft(userDocument.bio || "");
    setBioTouched(false);
    if (location.state?.profileEdit && window.history.state?.idx > 0) navigate(-1);
    else navigate("/profile", { replace: true });
  }, [currentUser?.displayName, dirty, location.state?.profileEdit, navigate, userDocument.bio]);
  useEffect(() => {
    if (!editMode || showAvatarPicker || showLogoutConfirm) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeEdit();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeEdit, editMode, showAvatarPicker, showLogoutConfirm]);
  const openEdit = () => navigate("/profile/edit", { state: { profileEdit: true } });
  const backToChats = () => {
    if (location.state?.mobileTabSwitch && window.history.state?.idx > 0) navigate(-1);
    else navigate("/", { replace: true });
  };

  const signOutUser = async () => {
    try {
      closeSignOut();
      await signOut(auth);
      navigate("/login");
    } catch (cause) {
      console.error("Could not sign out:", cause);
      setError("Could not sign out. Please try again.");
    }
  };

  const copyValue = async (value) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (cause) {
      console.error("Could not copy profile information:", cause);
    }
  };

  const setOverlay = (open) => window.dispatchEvent(new CustomEvent("chathere:mobile-overlay", { detail: { open } }));
  const openAvatarPicker = () => { setShowAvatarPicker(true); setOverlay(true); };
  const closeAvatarPicker = () => { setShowAvatarPicker(false); setOverlay(false); };
  const openSignOut = () => { setShowLogoutConfirm(true); setOverlay(true); };
  const closeSignOut = () => { setShowLogoutConfirm(false); setOverlay(false); };

  return <main data-main-scroll className="ember-bg relative h-full overflow-y-auto overscroll-contain tab-scroll-padding">
    <div className="mx-auto w-full max-w-[640px] pb-6">
      <div aria-hidden={editMode}>
        <ScreenHeader action={<button type="button" onClick={openEdit} className="icon-btn-glass" aria-label="Edit profile"><Edit2 size={18} /></button>}>
          <button type="button" onClick={backToChats} className="desktop-profile-back icon-btn-glass" aria-label="Back to chats"><ArrowLeft size={19} /></button>
        </ScreenHeader>
        {error && <p role="alert" className="mx-6 mb-3 text-sm text-[var(--danger-text)]">{error}</p>}
        <section className="px-5 pb-5 pt-4 text-center">
          <div className="relative mx-auto mb-3 h-[104px] w-[104px] rounded-full border-2 border-[var(--border-strong)]">
            <Avatar src={currentUser?.photoURL} name={currentUser?.displayName || currentUser?.email || "Profile"} size={100} className="h-full w-full rounded-full" />
            <button type="button" onClick={openAvatarPicker} className="absolute bottom-0 right-0 inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-[var(--bg)] bg-[var(--primary)] text-[var(--on-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label="Change profile photo"><Camera size={18} /></button>
          </div>
          <h2 className="break-words text-[22px] font-bold leading-tight text-[var(--text-1)]">{currentUser?.displayName || "Profile"}</h2>
          <p className="mt-1 truncate text-sm text-[var(--text-2)]">{currentUser?.email || userDocument.bio || ""}</p>
          <button type="button" onClick={openEdit} className="ember-primary-action mt-4 min-h-11 rounded-full px-5 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">Edit profile</button>
        </section>

        {profileStats.length > 0 && <section className={`mx-4 mb-5 grid gap-2 ${profileStats.length === 1 ? "grid-cols-1" : "grid-cols-2"}`} aria-label="Profile statistics">
          {profileStats.map((stat) => <StatCard key={stat.label} {...stat} />)}
        </section>}

        <Section title="Personal information">
          <SettingsGroup>
            {userDocument.bio && <SettingsRow icon={Info} label="About" value={userDocument.bio} chevron={false} onClick={() => copyValue(userDocument.bio)} />}
            {currentUser?.email && <SettingsRow icon={Mail} label="Email" value={currentUser.email} chevron={false} onClick={() => copyValue(currentUser.email)} />}
            {memberSince && <SettingsRow icon={Calendar} label="Joined" value={memberSince} chevron={false} onClick={() => copyValue(memberSince)} />}
            {!userDocument.bio && !currentUser?.email && !memberSince && <p className="px-3 py-4 text-sm text-[var(--text-2)]">No profile information available yet.</p>}
          </SettingsGroup>
        </Section>

        <Section title="Quick links">
          <SettingsGroup>
            <SettingsRow icon={Settings} label="Settings" onClick={() => navigate("/settings", { replace: true, state: location.state?.mobileTabSwitch ? { mobileTabSwitch: true } : null })} />
            <SettingsRow icon={Archive} label="Archived chats" onClick={() => {
              navigate("/", { replace: true, state: location.state?.mobileTabSwitch ? { mobileTabSwitch: true } : null });
              window.setTimeout(() => window.dispatchEvent(new Event("chathere:show-archived")), 0);
            }} />
          </SettingsGroup>
        </Section>

        <Section title="Account">
          <SettingsGroup><SettingsRow icon={LogOut} label="Sign out" danger onClick={openSignOut} /></SettingsGroup>
        </Section>
      </div>
      <AnimatePresence>
        {editMode && <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Edit profile"
          className="profile-edit-screen ember-bg"
          initial={reduceMotion ? false : { opacity: 0, x: "100%" }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: "100%" }}
          transition={{ duration: reduceMotion ? 0 : .24, ease: "easeOut" }}
        >
          <div className="mx-auto w-full max-w-[640px] pb-6">
            <ScreenHeader title="Edit profile">
              <button type="button" onClick={closeEdit} className="icon-btn-glass" aria-label="Back to profile"><ArrowLeft size={19} /></button>
            </ScreenHeader>
            <Section title="Profile details">
              <SettingsGroup className="p-4">
                <label className="profile-field-label" htmlFor="profile-name">Display name</label>
                <input id="profile-name" className="profile-field" maxLength={80} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && saveProfile()} autoComplete="name" autoFocus />
                <label className="profile-field-label mt-4" htmlFor="profile-about">About</label>
                <textarea id="profile-about" className="profile-field min-h-28 resize-y" value={bioDraft} onChange={(event) => { setBioTouched(true); setBioDraft(event.target.value); }} maxLength={140} placeholder="Write something about yourself" />
                <p className="mt-1 text-right text-xs text-[var(--text-2)]" aria-live="polite">{bioDraft.length}/140</p>
                {error && <p role="alert" className="mt-2 text-sm text-[var(--danger-text)]">{error}</p>}
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={closeEdit} className="chip min-h-11 flex-1 justify-center">Cancel</button>
                  <button type="button" onClick={saveProfile} disabled={saving} className="ember-primary-action min-h-11 flex-1 rounded-full px-4 text-sm font-semibold disabled:opacity-60">
                    <Check size={16} className="mr-1 inline" />{saving ? "Saving…" : "Save"}
                  </button>
                </div>
                <button type="button" onClick={openAvatarPicker} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] text-sm text-[var(--text-1)]"><Camera size={17} />Change profile photo</button>
              </SettingsGroup>
            </Section>
          </div>
        </motion.div>}
      </AnimatePresence>
    </div>

    {copied && <div role="status" className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[var(--surface-3)] px-3 py-2 text-xs font-medium text-[var(--text-1)] shadow-lg"><Check size={13} className="mr-1 inline" />Copied</div>}
    <AvatarPicker isOpen={showAvatarPicker} onClose={closeAvatarPicker} currentPhotoURL={currentUser?.photoURL} displayName={currentUser?.displayName} onSave={updateAvatar} />
    <Sheet open={showLogoutConfirm} onClose={closeSignOut} title="Sign out?">
      <p className="py-2 text-sm text-[var(--text-2)]">Are you sure you want to sign out of ChatHere?</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={closeSignOut} className="chip min-h-11 flex-1 justify-center">Cancel</button>
        <button type="button" onClick={signOutUser} className="min-h-11 flex-1 rounded-full bg-[var(--danger)] text-sm font-semibold text-[var(--on-danger)]">Sign out</button>
      </div>
    </Sheet>
  </main>;
};

export default Profile;
