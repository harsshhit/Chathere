import React, { lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Info, Mail, X } from "lucide-react";
import { updateProfile } from "firebase/auth";
import { doc, FieldPath, updateDoc, getDoc } from "firebase/firestore";
import { AuthContext } from "../context/AuthContext";
import { UserChatsMetadataContext, UserDocumentContext } from "../context/ChatContexts";
import Avatar from "../components/Avatar";
import { SettingsGroup, SettingsRow, ScreenHeader, Section, StatCard, Toast } from "../components/ui";
import { auth, db } from "../firebase";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { formatLongDate } from "../utils/formatters";
import useCopyToClipboard from "../utils/useCopyToClipboard";
import LazyImage from "../components/ui/LazyImage";
import { mergeCachedUserDocument } from "../utils/userDocumentCache";
import { normalizeSearchText } from "../utils/searchableName";

const AvatarPicker = lazy(() => import("../components/AvatarPicker"));
const ProfileEditScreen = lazy(() => import("./ProfileEditScreen"));

const Profile = () => {
  const { currentUser, updateAuthUser } = useContext(AuthContext);
  const userChats = useContext(UserChatsMetadataContext);
  const userDocument = useContext(UserDocumentContext);
  const navigate = useNavigate();
  const location = useLocation();
  const editMode = location.pathname === "/profile/edit";
  const reduceMotion = useReducedMotion();
  const [nameDraft, setNameDraft] = useState(currentUser?.displayName || "");
  const [bioDraft, setBioDraft] = useState(userDocument.bio || "");
  const [bioTouched, setBioTouched] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showAvatarViewer, setShowAvatarViewer] = useState(false);
  const [saving, setSaving] = useState(false);
  const { copied, copyText: copyValue } = useCopyToClipboard(1600);
  const [error, setError] = useState("");
  const dirty = nameDraft.trim() !== (currentUser?.displayName || "") || bioDraft !== (userDocument.bio || "");
  const confirmDiscardChanges = useCallback(
    () => !dirty || window.confirm("Discard your unsaved profile changes?"),
    [dirty]
  );

  useEffect(() => {
    setNameDraft(currentUser?.displayName || "");
  }, [currentUser?.uid, currentUser?.displayName]);

  useEffect(() => {
    if (!editMode || !bioTouched) setBioDraft(userDocument.bio || "");
  }, [userDocument.bio, editMode, bioTouched]);

  useEffect(() => {
    const onPopState = () => {
      if (editMode && dirty) {
        if (!confirmDiscardChanges()) {
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
  }, [confirmDiscardChanges, currentUser?.displayName, dirty, editMode, navigate, userDocument.bio]);

  const chatEntries = useMemo(() => Object.entries(userChats || {}).filter(([, entry]) => entry?.userInfo), [userChats]);
  const groupCount = chatEntries.filter(([, entry]) => entry.userInfo?.isGroup).length;
  const profileStats = chatEntries.length ? [
    { label: "Chats", value: chatEntries.length },
    { label: "Groups", value: groupCount },
  ] : [];
  const memberSince = formatLongDate(currentUser?.metadata?.creationTime, { year: "numeric", month: "long", day: "numeric" });

  const propagateProfileToChats = async (changes) => {
    let snapshot;
    try {
      snapshot = await getDoc(doc(db, "userChats", currentUser.uid));
    } catch (error) {
      console.warn("Could not read chats while refreshing profile details:", error);
      setError("Your profile was saved, but some chat details could not be refreshed.");
      return;
    }
    if (!snapshot.exists()) return;

    const updatesByUser = new Map();
    Object.entries(snapshot.data() || {}).forEach(([chatId, entry]) => {
      const otherUid = entry?.userInfo?.uid;
      if (!otherUid || entry.userInfo.isGroup || otherUid === currentUser.uid) return;
      const updates = updatesByUser.get(otherUid) || [];
      Object.entries(changes).forEach(([field, value]) => {
        updates.push(new FieldPath(chatId, "userInfo", field), value);
      });
      updatesByUser.set(otherUid, updates);
    });

    const results = await Promise.allSettled(
      [...updatesByUser.entries()].map(([uid, updates]) =>
        updateDoc(doc(db, "userChats", uid), ...updates)
      )
    );
    const failures = results.filter((result) => result.status === "rejected");
    if (failures.length > 0) {
      failures.forEach((result) => console.warn("Could not refresh a chat profile entry:", result.reason));
      setError("Your profile was saved, but some chat details could not be refreshed.");
    }
  };

  const updateAvatar = async (photoURL) => {
    if (!auth.currentUser || !currentUser?.uid || !photoURL) return;
    await updateProfile(auth.currentUser, { photoURL });
    await updateDoc(doc(db, "users", currentUser.uid), { photoURL });
    mergeCachedUserDocument(currentUser.uid, { photoURL });
    updateAuthUser?.({ photoURL });
    await propagateProfileToChats({ photoURL });
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
      const nextBio = bioDraft.trim();
      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName,
        displayNameLower: normalizeSearchText(displayName),
        bio: nextBio,
      });
      mergeCachedUserDocument(currentUser.uid, { displayName, displayNameLower: normalizeSearchText(displayName), bio: nextBio });
      updateAuthUser?.({ displayName });
      await propagateProfileToChats({ displayName });
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
    if (!confirmDiscardChanges()) return;
    setNameDraft(currentUser?.displayName || "");
    setBioDraft(userDocument.bio || "");
    setBioTouched(false);
    if (location.state?.profileEdit && window.history.state?.idx > 0) navigate(-1);
    else navigate("/profile", { replace: true });
  }, [confirmDiscardChanges, currentUser?.displayName, location.state?.profileEdit, navigate, userDocument.bio]);
  useEffect(() => {
    if (!editMode || showAvatarPicker) return undefined;
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeEdit();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeEdit, editMode, showAvatarPicker]);
  const openEdit = () => navigate("/profile/edit", { state: { profileEdit: true } });
  const backToChats = () => {
    if (location.state?.mobileTabSwitch && window.history.state?.idx > 0) navigate(-1);
    else navigate("/", { replace: true });
  };

  const setOverlay = (open) => window.dispatchEvent(new CustomEvent("chathere:mobile-overlay", { detail: { open } }));
  const preloadAvatarPicker = () => {
    import("../components/AvatarPicker").catch((cause) => console.error("Could not preload avatar picker:", cause));
  };
  const openAvatarPicker = () => { preloadAvatarPicker(); setShowAvatarPicker(true); setOverlay(true); };
  const closeAvatarPicker = () => { setShowAvatarPicker(false); setOverlay(false); };
  return <main data-main-scroll className="ember-bg relative h-full overflow-y-auto overscroll-contain tab-scroll-padding">
    <div className="mx-auto w-full max-w-[640px] pb-6">
      <div aria-hidden={editMode}>
        <ScreenHeader>
          <button type="button" onClick={backToChats} className="desktop-profile-back icon-btn-glass" aria-label="Back to chats"><ArrowLeft size={19} /></button>
        </ScreenHeader>
        {error && <p role="alert" className="mx-6 mb-3 text-sm text-[var(--danger-text)]">{error}</p>}
        <section className="px-5 pb-5 pt-4 text-center">
          <div className="relative mx-auto mb-3 h-[104px] w-[104px] rounded-full border-2 border-[var(--border-strong)]">
            <button type="button" onClick={() => setShowAvatarViewer(true)} className="h-full w-full rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label="View profile photo">
              <Avatar src={currentUser?.photoURL} name={currentUser?.displayName || currentUser?.email || "Profile"} size={100} className="h-full w-full rounded-full" />
            </button>
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
          <Suspense fallback={<div className="mx-auto mt-12 h-48 w-[min(90%,40rem)] animate-pulse rounded-3xl bg-[var(--surface-2)]" aria-label="Loading profile editor" />}>
            <ProfileEditScreen
              closeEdit={closeEdit}
              openAvatarPicker={openAvatarPicker}
              preloadAvatarPicker={preloadAvatarPicker}
              currentUser={currentUser}
              nameDraft={nameDraft}
              setNameDraft={setNameDraft}
              bioDraft={bioDraft}
              setBioDraft={setBioDraft}
              setBioTouched={setBioTouched}
              error={error}
              saveProfile={saveProfile}
              saving={saving}
            />
          </Suspense>
        </motion.div>}
      </AnimatePresence>
    </div>

    {copied && <Toast className="bottom-24">Copied</Toast>}
    {showAvatarPicker && <Suspense fallback={<div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40" aria-label="Loading avatar picker"><div className="glass-card h-64 w-[min(90vw,28rem)] animate-pulse rounded-3xl" /></div>}><AvatarPicker isOpen onClose={closeAvatarPicker} currentPhotoURL={currentUser?.photoURL} displayName={currentUser?.displayName} onSave={updateAvatar} /></Suspense>}
    {showAvatarViewer && <div role="dialog" aria-modal="true" aria-label="Profile photo" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={(event) => event.target === event.currentTarget && setShowAvatarViewer(false)}>
      <button type="button" onClick={() => setShowAvatarViewer(false)} className="absolute right-4 top-4 icon-btn-glass" aria-label="Close profile photo"><X size={20} /></button>
      {currentUser?.photoURL && <LazyImage src={currentUser.photoURL} alt={currentUser.displayName || "Profile"} width={1200} height={1200} priority objectFit="contain" className="max-h-full max-w-full rounded-lg" />}
    </div>}
  </main>;
};

export default Profile;
