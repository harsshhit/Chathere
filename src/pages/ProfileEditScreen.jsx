import React from "react";
import { ArrowLeft, Check } from "lucide-react";
import { Section, ScreenHeader, SettingsGroup } from "../components/ui";
import Avatar from "../components/Avatar";

export default function ProfileEditScreen({
  closeEdit,
  openAvatarPicker,
  preloadAvatarPicker,
  currentUser,
  nameDraft,
  setNameDraft,
  bioDraft,
  setBioDraft,
  setBioTouched,
  error,
  saveProfile,
  saving,
}) {
  return <div className="mx-auto w-full max-w-[640px] pb-6">
    <ScreenHeader title="Edit profile">
      <button type="button" onClick={closeEdit} className="icon-btn-glass" aria-label="Back to profile"><ArrowLeft size={19} /></button>
    </ScreenHeader>
    <Section title="Profile details">
      <SettingsGroup className="p-4">
        <div className="mb-4 flex justify-center">
          <button type="button" onClick={openAvatarPicker} onPointerEnter={preloadAvatarPicker} onFocus={preloadAvatarPicker} onTouchStart={preloadAvatarPicker} className="h-20 w-20 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label="Change profile photo">
            <Avatar src={currentUser?.photoURL} name={currentUser?.displayName || currentUser?.email || "Profile"} size={80} className="h-full w-full rounded-full" />
          </button>
        </div>
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
      </SettingsGroup>
    </Section>
  </div>;
}
