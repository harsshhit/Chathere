import React, { useState, useEffect, useRef } from "react";
import { X, Shuffle, Check, Loader2, Sparkles, Image as ImageIcon, Link as LinkIcon, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar, { isValidAvatarUrl } from "./Avatar";
import GifPicker from "./GifPicker";
import { uploadImage } from "../utils/cloudinary";

const DICEBEAR_STYLES = [
  { id: "bottts", label: "Robots" },
  { id: "avataaars", label: "Avataaars" },
  { id: "fun-emoji", label: "Emoji" },
  { id: "lorelei", label: "Lorelei" },
  { id: "adventurer", label: "Adventurer" },
  { id: "thumbs", label: "Thumbs" },
  { id: "notionists", label: "Notionists" },
];

const getDiceBearUrl = (style, seed) => {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
};

const AvatarPicker = ({ isOpen, onClose, currentPhotoURL, displayName, onSave }) => {
  const [activeTab, setActiveTab] = useState("avatars"); // "avatars" | "gifs" | "url"
  const [seed, setSeed] = useState(() => Math.random().toString(36).substring(2, 9));
  const [selectedStyle, setSelectedStyle] = useState("bottts");
  const [selectedUrl, setSelectedUrl] = useState(currentPhotoURL || "");
  const [customUrl, setCustomUrl] = useState("");
  const [urlTesting, setUrlTesting] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [urlValid, setUrlValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);

  const debounceTimeout = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => () => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
  }, [localPreviewUrl]);

  // Initialize selectedUrl from props when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedUrl(currentPhotoURL || getDiceBearUrl("bottts", seed));
      setSaveError(null);
    }
  }, [isOpen, currentPhotoURL, seed]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen && !isSaving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  const handleShuffle = () => {
    setSelectedFile(null);
    setLocalPreviewUrl("");
    const newSeed = Math.random().toString(36).substring(2, 9);
    setSeed(newSeed);
    const newUrl = getDiceBearUrl(selectedStyle, newSeed);
    setSelectedUrl(newUrl);
  };

  const handleSelectStyle = (styleId) => {
    setSelectedFile(null);
    setLocalPreviewUrl("");
    setSelectedStyle(styleId);
    const newUrl = getDiceBearUrl(styleId, seed);
    setSelectedUrl(newUrl);
  };

  const handleGifSelect = (gifUrl) => {
    if (isValidAvatarUrl(gifUrl)) {
      setSelectedFile(null);
      setLocalPreviewUrl("");
      setSelectedUrl(gifUrl);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    const previewUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setLocalPreviewUrl(previewUrl);
    setSelectedUrl(previewUrl);
    setSaveError(null);
    setUploadProgress(0);
  };

  // Validate custom image URL with an Image() element
  const handleCustomUrlChange = (value) => {
    setCustomUrl(value);
    setUrlError(null);
    setUrlValid(false);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      setUrlTesting(false);
      return;
    }

    if (!isValidAvatarUrl(trimmed)) {
      setUrlTesting(false);
      setUrlError("URL must begin with https:// and be under 2000 characters.");
      return;
    }

    setUrlTesting(true);
    debounceTimeout.current = setTimeout(() => {
      const img = new Image();
      img.referrerPolicy = "no-referrer";
      img.onload = () => {
        setUrlTesting(false);
        setUrlValid(true);
        setUrlError(null);
        setSelectedFile(null);
        setLocalPreviewUrl("");
        setSelectedUrl(trimmed);
      };
      img.onerror = () => {
        setUrlTesting(false);
        setUrlValid(false);
        setUrlError("Could not load image. Please check the link.");
      };
      img.src = trimmed;
    }, 400);
  };

  const handleSaveClick = async () => {
    if (!selectedFile && (!selectedUrl || !isValidAvatarUrl(selectedUrl))) {
      setSaveError("Please select a valid avatar image.");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const photoUrl = selectedFile
        ? await uploadImage(selectedFile, { folder: "chathere/profiles", onProgress: setUploadProgress })
        : selectedUrl;
      if (selectedFile) {
        setSelectedUrl(photoUrl);
        setSelectedFile(null);
        setLocalPreviewUrl("");
      }
      await onSave(photoUrl);
      onClose();
    } catch (err) {
      setSaveError(err.message || "Failed to update profile picture.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        style={{ background: "var(--overlay)", backdropFilter: "blur(var(--blur-lg))" }}
        onClick={() => !isSaving && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="glass-card w-full max-w-lg overflow-hidden flex flex-col my-auto"
          style={{
            maxHeight: "90vh",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            boxShadow: "0 25px 50px -12px var(--shadow)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[var(--primary-text)]" />
              <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                Choose Profile Picture
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="icon-btn min-h-11 min-w-11"
              aria-label="Close"
              style={{ touchAction: "manipulation" }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Live Preview Bar */}
          <div
            className="px-5 py-3.5 flex items-center gap-4 flex-shrink-0"
            style={{
              background: "var(--surface-3)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="relative">
              {localPreviewUrl ? (
                <img src={localPreviewUrl} alt={displayName || "Preview"} className="h-[68px] w-[68px] rounded-2xl object-cover shadow-sm" style={{ border: "2px solid var(--primary-glow)" }} />
              ) : (
                <Avatar
                  src={selectedUrl}
                  name={displayName || "Preview"}
                  size={68}
                  className="w-[68px] h-[68px] rounded-2xl object-cover shadow-sm"
                  style={{ border: "2px solid var(--primary-glow)" }}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--primary-light)] mb-0.5">
                Live Preview
              </div>
              <div className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                {displayName || "Your Profile"}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isSaving} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary-text)] disabled:opacity-50">
                <Upload size={12} /> Upload image
              </button>
              {isSaving && selectedFile && <div className="mt-1 h-1 w-full overflow-hidden rounded bg-[var(--subtle)]"><div className="h-full bg-[var(--primary)]" style={{ width: `${uploadProgress}%` }} /></div>}
            </div>
          </div>

          {/* Tabs */}
          <div
            className="flex px-5 pt-3 gap-2 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("avatars")}
              className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "avatars"
                  ? "border-[var(--primary-border)] text-[var(--primary-text)] dark:text-[var(--primary-text)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Sparkles size={14} />
              <span>Avatars</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("gifs")}
              className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "gifs"
                  ? "border-[var(--primary-border)] text-[var(--primary-text)] dark:text-[var(--primary-text)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <ImageIcon size={14} />
              <span>GIFs</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("url")}
              className={`flex items-center gap-1.5 pb-2.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "url"
                  ? "border-[var(--primary-border)] text-[var(--primary-text)] dark:text-[var(--primary-text)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <LinkIcon size={14} />
              <span>Image URL</span>
            </button>
          </div>

          {/* Tab Content Body */}
          <div className="flex-1 overflow-y-auto p-5 custom-scrollbar min-h-[260px] max-h-[380px]">
            {/* Tab 1: DiceBear Avatars */}
            {activeTab === "avatars" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Pick a style or randomize:
                  </span>
                  <button
                    type="button"
                    onClick={handleShuffle}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors"
                    style={{
                      background: "var(--primary-soft)",
                      color: "var(--primary-light)",
                      border: "1px solid var(--primary-glow)",
                    }}
                  >
                    <Shuffle size={13} />
                    <span>Shuffle</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {DICEBEAR_STYLES.map((style) => {
                    const avatarUrl = getDiceBearUrl(style.id, seed);
                    const isSelected = selectedUrl === avatarUrl || selectedStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => handleSelectStyle(style.id)}
                        className={`p-2.5 rounded-xl flex flex-col items-center gap-2 transition-all text-center relative ${
                          isSelected
                            ? "ring-2 ring-[var(--ring)] bg-[var(--primary-soft)]"
                            : "hover:bg-[var(--surface-3)]"
                        }`}
                        style={{
                          background: isSelected ? undefined : "var(--surface-3)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <Avatar
                          src={avatarUrl}
                          name={style.label}
                          size={52}
                          className="w-[52px] h-[52px] rounded-xl object-cover"
                        />
                        <span className="text-[11px] font-medium truncate w-full" style={{ color: "var(--text-primary)" }}>
                          {style.label}
                        </span>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--primary)] text-[var(--on-primary)] flex items-center justify-center">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 2: GIFs */}
            {activeTab === "gifs" && (
              <div className="flex flex-col items-center justify-center">
                <p className="text-xs text-[var(--text-muted)] mb-3 self-start">
                  Select a trending GIF or search below:
                </p>
                <div className="w-full flex justify-center">
                  <GifPicker onGifSelect={handleGifSelect} />
                </div>
              </div>
            )}

            {/* Tab 3: Direct Image URL */}
            {activeTab === "url" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
                    Paste Direct Image Link (HTTPS only)
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => handleCustomUrlChange(e.target.value)}
                      placeholder="https://example.com/avatar.png"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl outline-none pr-9"
                      style={{
                        background: "var(--surface-3)",
                        border: urlError
                          ? "1px solid var(--danger)"
                          : urlValid
                          ? "1px solid var(--success)"
                          : "1px solid var(--border)",
                        color: "var(--text-primary)",
                      }}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {urlTesting && <Loader2 size={14} className="animate-spin text-[var(--primary-text)]" />}
                      {urlValid && <Check size={14} className="text-[var(--success)]" />}
                    </div>
                  </div>
                </div>

                {urlError && (
                  <div className="text-xs text-[var(--danger-text)] leading-tight">
                    {urlError}
                  </div>
                )}

                {urlValid && (
                  <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: "var(--success-bg)", border: "1px solid var(--success)" }}>
                    <Check size={16} className="text-[var(--success)] flex-shrink-0" />
                    <span className="text-xs text-[var(--success-text)] font-medium">
                      Valid image URL! Preview updated above.
                    </span>
                  </div>
                )}

                <div className="p-3 rounded-xl text-xs space-y-1" style={{ background: "var(--surface-3)", color: "var(--text-muted)" }}>
                  <p className="font-semibold text-[var(--text-secondary)]">Tips for direct links:</p>
                  <p>• Must begin with <code className="text-[var(--primary-text)]">https://</code></p>
                  <p>• Supported formats: PNG, JPG, WebP, GIF, SVG</p>
                  <p>• Data URLs (data:) and blob: URLs are not allowed for security</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Save & Cancel */}
          <div
            className="px-5 py-3.5 flex items-center justify-between flex-shrink-0 gap-3"
            style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}
          >
            {saveError && (
              <span className="text-xs text-[var(--danger-text)] truncate flex-1">{saveError}</span>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold rounded-xl transition-colors"
                style={{
                  background: "var(--surface-3)",
                  color: "var(--text-secondary)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={isSaving || !selectedUrl}
                className="ember-primary-action inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <Check size={13} />
                    <span>{saveError && selectedFile ? "Retry upload" : "Save Photo"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AvatarPicker;
