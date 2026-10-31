import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Bell, Eye, EyeOff, Music, Smartphone, Volume2, VolumeX } from "lucide-react";
import { ScreenHeader, Section, SettingsGroup, SettingsRow, Toggle } from "../components/ui";

const TONES = [
  { id: "chime", label: "Chime" },
  { id: "ping", label: "Ping" },
  { id: "pop", label: "Pop" },
  { id: "bell", label: "Bell" },
];

export default function NotificationSettingsScreen({
  backFromSettings,
  permissionLabel,
  permissionState,
  iosNeedsInstall,
  requestPermission,
  notifSettings,
  saveNotificationOption,
  playTonePreview,
  testSent,
  sendTest,
  error,
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Notification settings"
      className="settings-subscreen ember-bg"
      initial={reduceMotion ? false : { x: "100%" }}
      animate={{ x: 0 }}
      exit={reduceMotion ? undefined : { x: "100%" }}
      transition={{ duration: reduceMotion ? 0 : .24, ease: "easeOut" }}
    >
      <div className="mx-auto w-full max-w-[640px] pb-6">
        <ScreenHeader title="Notifications">
          <button type="button" onClick={backFromSettings} className="icon-btn-glass" aria-label="Back to settings" autoFocus><ArrowLeft size={19} /></button>
        </ScreenHeader>
        <Section title="Permission">
          <SettingsGroup>
            <SettingsRow icon={Bell} label="Message notifications" value={permissionLabel} control={permissionState === "default" && !iosNeedsInstall
              ? <button type="button" onClick={requestPermission} className="chip min-h-11">Enable</button>
              : null} />
            {iosNeedsInstall && <p className="px-3 py-3 text-sm text-[var(--text-2)]">Install ChatHere to enable notifications on this device.</p>}
          </SettingsGroup>
        </Section>
        <Section title="Message notifications">
          <SettingsGroup>
            <SettingsRow icon={notifSettings.sound ? Volume2 : VolumeX} label="Notification sound" control={<Toggle checked={notifSettings.sound} onChange={(value) => saveNotificationOption("sound", value)} label="Notification sound" />} />
            {notifSettings.sound && <div className="px-3 py-3">
              <div className="mb-2 flex items-center justify-between text-sm text-[var(--text-2)]">
                <span className="inline-flex items-center gap-2"><Music size={16} />Alert tone</span>
                <button type="button" onClick={() => playTonePreview(notifSettings.tone)} className="chip min-h-11">Preview</button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {TONES.map((tone) => <button type="button" key={tone.id} onClick={() => {
                  saveNotificationOption("tone", tone.id);
                  playTonePreview(tone.id);
                }} className={`chip min-h-11 justify-center ${notifSettings.tone === tone.id ? "chip-active" : ""}`}>{tone.label}</button>)}
              </div>
            </div>}
            <SettingsRow icon={Smartphone} label="Vibration" control={<Toggle checked={notifSettings.vibrate} onChange={(value) => saveNotificationOption("vibrate", value)} label="Vibration" />} />
            <SettingsRow icon={notifSettings.showPreview ? Eye : EyeOff} label="Message previews" value={notifSettings.showPreview ? "Show message" : "Hide message"} control={<Toggle checked={notifSettings.showPreview} onChange={(value) => saveNotificationOption("showPreview", value)} label="Message previews" />} />
            {permissionState === "granted" && <SettingsRow icon={Bell} label={testSent ? "Test sent" : "Send test notification"} onClick={sendTest} />}
          </SettingsGroup>
        </Section>
        {error && <p role="alert" className="mx-6 mb-4 text-sm text-[var(--danger-text)]">{error}</p>}
      </div>
    </motion.div>
  );
}
