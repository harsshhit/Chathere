import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { AlertCircle, Download, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import { getAudioPlaybackUrl } from "../utils/cloudinary";
import { safeHttpUrl } from "../utils/safeUrl";
import { formatVoiceDuration } from "../utils/voiceRecorder";
import useInView from "../hooks/useInView";
import { useMediaPolicy } from "../utils/mediaPolicy";
import { prefetchAudio } from "../utils/prefetchAudio";
import { getOwnMediaUrl, rememberOwnMedia } from "../utils/ownMediaCache";

let activeVoice = null;
const voicePlayers = new Map();
const PLAYED_IDS_KEY = "chathere:played-voice-ids";

export const clearPlayedVoiceState = () => {
  if (typeof window === "undefined") return;
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key === PLAYED_IDS_KEY || key?.startsWith("chathere:played:")) {
        window.localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn("Could not clear voice playback state:", error);
  }
};

export const pauseActiveVoiceMessage = () => {
  activeVoice?.element?.pause();
};

export const activateVoiceMessage = (id, element) => {
  if (activeVoice?.element && activeVoice.element !== element) {
    activeVoice.element.pause();
    clearMediaActions(typeof navigator !== "undefined" ? navigator.mediaSession : null);
  }
  activeVoice = { id, element };
};

export const deactivateVoiceMessage = (element) => {
  if (activeVoice?.element !== element) return;
  activeVoice = null;
  clearMediaActions(typeof navigator !== "undefined" ? navigator.mediaSession : null);
};

const isPlayed = (id) => {
  if (!id || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`chathere:played:${id}`) === "1";
  } catch {
    return false;
  }
};

const markPlayed = (id) => {
  if (!id || typeof window === "undefined") return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(PLAYED_IDS_KEY) || "[]");
    const ids = [...new Set([...stored.filter((value) => typeof value === "string"), id])].slice(-500);
    ids.forEach((value) => window.localStorage.setItem(`chathere:played:${value}`, "1"));
    const previous = stored.filter((value) => typeof value === "string");
    previous.filter((value) => !ids.includes(value)).forEach((value) => window.localStorage.removeItem(`chathere:played:${value}`));
    window.localStorage.setItem(PLAYED_IDS_KEY, JSON.stringify(ids));
  } catch {
    // Playback remains available when storage is disabled.
  }
};

const getAudio = (message) => message?.audio || (message?.file?.url ? {
  url: message.file.url,
  duration: message.file.duration,
  peaks: message.file.peaks,
  mime: message.file.mime,
  size: message.file.size,
} : null);

const normalizePeaks = (peaks) => {
  if (!Array.isArray(peaks) || peaks.length !== 40 || peaks.some((peak) => !Number.isInteger(peak) || peak < 6 || peak > 100)) {
    return Array.from({ length: 40 }, () => 20);
  }
  return peaks;
};

const setMediaAction = (mediaSession, action, handler) => {
  try {
    mediaSession.setActionHandler(action, handler);
  } catch {
    // Not all browsers support every Media Session action.
  }
};

const clearMediaActions = (mediaSession) => {
  if (!mediaSession) return;
  ["play", "pause", "seekbackward", "seekforward", "seekto"].forEach((action) => {
    setMediaAction(mediaSession, action, null);
  });
};

const VoiceMessage = memo(function VoiceMessage({
  message,
  isOwn = false,
  chatId,
  isBubble = true,
  nextMessage = null,
  uploadProgress = 0,
  uploading = false,
  uploadFailed = false,
  uploadError = "",
  onCancelUpload,
  onRetryUpload,
  onDeleteUpload,
}) {
  const audioData = getAudio(message);
  const localUrl = isOwn && audioData?.url?.startsWith("blob:") ? audioData.url : "";
  const ownMediaUrl = isOwn ? getOwnMediaUrl(message?.id) : "";
  const audioUrl = safeHttpUrl(audioData?.url);
  const source = ownMediaUrl || localUrl || getAudioPlaybackUrl(audioUrl || "");
  const downloadUrl = ownMediaUrl || localUrl || safeHttpUrl(source);
  const duration = Number.isFinite(audioData?.duration) ? Math.max(0, audioData.duration) : 0;
  const isOwnBubble = isOwn && isBubble;
  const bars = normalizePeaks(audioData?.peaks);
  const audioRef = useRef(null);
  const sliderRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const [preloaded, setPreloaded] = useState(false);
  const [prefetchedUrl, setPrefetchedUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [playedBefore, setPlayedBefore] = useState(() => isPlayed(message?.id));
  const preloadMargin = `${Math.round((typeof window !== "undefined" ? window.innerHeight : 800) * 1.5)}px 0px`;
  const [prefetchRef, withinPreloadRange] = useInView({ rootMargin: preloadMargin, dwellMs: 120 });
  const { shouldAutoLoad } = useMediaPolicy();
  const canPrefetch = shouldAutoLoad("audio");
  const shouldPrefetch = canPrefetch && !source.startsWith("blob:");

  const play = useCallback(async () => {
    const element = audioRef.current;
    if (!element || !source) return;
    setBuffering(true);
    setFailed(false);
    activateVoiceMessage(message.id, element);
    try {
      let playableSource = prefetchedUrl;
      if (!playableSource && shouldPrefetch) {
        try {
          playableSource = await prefetchAudio(source) || "";
        } catch (error) {
          console.warn("Could not prefetch voice message:", error);
        }
      }
      if (!playableSource) {
        playableSource = source;
        setPreloaded(true);
      } else {
        setPrefetchedUrl(playableSource);
        if (isOwn && playableSource.startsWith("blob:")) rememberOwnMedia(message.id, chatId, playableSource);
      }
      if (isOwn && source.startsWith("blob:")) rememberOwnMedia(message.id, chatId, source);
      if (element.src !== playableSource) {
        element.src = playableSource;
        element.load();
      }
      await element.play();
      setPlayedBefore(true);
      markPlayed(message.id);
      if (typeof navigator !== "undefined" && navigator.mediaSession && typeof window.MediaMetadata === "function") {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: `Voice message from ${message.senderName || "User"}`,
          artist: "Chathere",
        });
        setMediaAction(navigator.mediaSession, "play", () => element.play());
        setMediaAction(navigator.mediaSession, "pause", () => element.pause());
        setMediaAction(navigator.mediaSession, "seekbackward", (details) => {
          element.currentTime = Math.max(0, element.currentTime - (details.seekOffset || 10));
        });
        setMediaAction(navigator.mediaSession, "seekforward", (details) => {
          element.currentTime = Math.min(duration, element.currentTime + (details.seekOffset || 10));
        });
        setMediaAction(navigator.mediaSession, "seekto", (details) => {
          if (Number.isFinite(details.seekTime)) element.currentTime = Math.min(duration, details.seekTime);
        });
      }
    } catch {
      deactivateVoiceMessage(element);
      setFailed(true);
      setBuffering(false);
    }
  }, [chatId, duration, isOwn, message.id, message.senderName, prefetchedUrl, shouldPrefetch, source]);

  useEffect(() => {
    if (!withinPreloadRange || !shouldPrefetch || !source || prefetchedUrl) return undefined;
    let active = true;
    prefetchAudio(source).then((url) => {
      if (active && url?.startsWith("blob:")) {
        setPrefetchedUrl(url);
        if (isOwn && url.startsWith("blob:")) rememberOwnMedia(message.id, chatId, url);
      }
    }).catch((error) => console.warn("Could not prefetch voice message:", error));
    return () => { active = false; };
  }, [chatId, isOwn, message.id, prefetchedUrl, shouldPrefetch, source, withinPreloadRange]);

  const prefetchOnIntent = () => {
    if (!shouldPrefetch || !source || prefetchedUrl) return;
    prefetchAudio(source).then((url) => {
      if (url?.startsWith("blob:")) {
        setPrefetchedUrl(url);
        if (isOwn && url.startsWith("blob:")) rememberOwnMedia(message.id, chatId, url);
      }
    }).catch((error) => console.warn("Could not prefetch voice message:", error));
  };
  useEffect(() => {
    const retryWhenOnline = () => {
      if (!offline) return;
      setOffline(false);
      setFailed(false);
      if (shouldPrefetch) {
        prefetchAudio(source).then((url) => {
          if (url) {
            setPrefetchedUrl(url);
            if (isOwn && url.startsWith("blob:")) rememberOwnMedia(message.id, chatId, url);
          }
        }).catch((error) => console.warn("Could not retry voice message:", error));
      } else {
        setPreloaded(true);
      }
    };
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [chatId, isOwn, message.id, offline, shouldPrefetch, source]);

  useEffect(() => {
    if (!message?.id) return undefined;
    voicePlayers.set(message.id, play);
    const element = audioRef.current;
    return () => {
      voicePlayers.delete(message.id);
      if (element) {
        element.pause();
        deactivateVoiceMessage(element);
      }
    };
  }, [message?.id, play]);

  if (!audioData?.url || message?.deleted || message?.deletedAt || message?.type === "deleted") return null;

  const seek = (event) => {
    const element = audioRef.current;
    const bounds = sliderRef.current?.getBoundingClientRect();
    if (!element || !bounds || duration <= 0) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    element.currentTime = fraction * duration;
    setCurrentTime(fraction * duration);
  };

  const progress = duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  const isUnplayed = !isOwn && !playedBefore;

  return (
    <div
      ref={prefetchRef}
      className="flex min-w-0 items-center gap-2.5"
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => (playing ? audioRef.current?.pause() : play())}
        onPointerEnter={prefetchOnIntent}
        onTouchStart={prefetchOnIntent}
        className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        aria-label={`${playing ? "Pause" : "Play"} voice message${uploading ? `, upload ${uploadProgress}%` : ""}`}
      >
        {uploading && <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 44 44" aria-label={`Uploading ${uploadProgress}%`}>
          <circle cx="22" cy="22" r="19" fill="none" stroke="var(--border-strong)" strokeWidth="2" />
          <circle cx="22" cy="22" r="19" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeDasharray={`${(Math.max(0, Math.min(100, uploadProgress)) / 100) * 119.4} 119.4`} />
        </svg>}
        {buffering ? <Loader2 size={18} className={shouldReduceMotion ? "" : "animate-spin"} aria-hidden="true" /> : playing ? <Pause size={18} fill="currentColor" aria-hidden="true" /> : <Play size={18} className="ml-0.5" fill="currentColor" aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1">
        <div
          ref={sliderRef}
          role="slider"
          tabIndex={0}
          aria-label="Voice message position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            seek(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons) seek(event);
          }}
          onPointerUp={seek}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const step = event.key === "ArrowRight" ? 5 : -5;
            const element = audioRef.current;
            if (!element) return;
            element.currentTime = Math.max(0, Math.min(duration, element.currentTime + step));
            setCurrentTime(element.currentTime);
          }}
          className="flex h-11 min-w-0 cursor-pointer items-center gap-[2px] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          style={{ touchAction: "none" }}
        >
          {bars.map((peak, index) => (
            <span
              key={index}
              className="min-w-[2px] flex-1 rounded-full"
              style={{
                height: `${Math.max(4, peak * 0.3)}px`,
                background: index / bars.length < progress
                  ? isOwnBubble ? "var(--on-bubble-sent)" : "var(--primary)"
                  : isOwnBubble ? "var(--on-bubble-sent)" : "var(--text-muted)",
                opacity: index / bars.length < progress ? 1 : 0.48,
              }}
            />
          ))}
        </div>
        <div className={`flex items-center justify-between gap-2 text-[11px] ${isOwnBubble ? "message-meta-own" : "text-[var(--text-secondary)]"}`}>
          <span className="tabular-nums">{formatVoiceDuration(playing || currentTime > 0 ? currentTime : duration)}</span>
          <div className="flex items-center gap-1">
            {isUnplayed && <span className="h-2 w-2 rounded-full bg-[var(--primary)]" aria-label="Unplayed voice message" title="Unplayed" />}
            <button type="button" onClick={() => setSpeed((value) => {
              const next = value === 1 ? 1.5 : value === 1.5 ? 2 : 1;
              if (audioRef.current) audioRef.current.playbackRate = next;
              return next;
            })} className={`min-h-11 min-w-11 rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${isOwnBubble ? "text-[var(--on-bubble-sent)]" : "text-[var(--text-primary)]"}`} aria-label={`Playback speed ${speed} times`}>
              {speed}x
            </button>
          </div>
        </div>
      </div>
      {uploading && onCancelUpload && <button type="button" onClick={onCancelUpload} className="min-h-11 min-w-11 rounded-full text-[var(--danger-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label="Cancel voice message upload">×</button>}
      {uploadFailed && <div className="flex flex-col items-start gap-1">
        <span className="text-xs font-semibold text-[var(--danger-text)]" role="status">{uploadError || "Failed"}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onRetryUpload} className="min-h-11 rounded px-2 text-xs font-semibold text-[var(--primary-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label="Retry voice message upload">Retry</button>
          <button type="button" onClick={onDeleteUpload} className="min-h-11 rounded px-2 text-xs font-semibold text-[var(--danger-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label="Delete failed voice message">Delete</button>
        </div>
      </div>}
      {failed && <div className="flex items-center gap-1 text-[var(--danger-text)]" role="status">
        <AlertCircle size={16} />
        {offline && <span className="text-xs">Offline</span>}
        <button type="button" onClick={() => {
          setFailed(false);
          setPreloaded(true);
          audioRef.current?.load();
          play();
        }} className="min-h-11 rounded px-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label="Retry voice playback">
          <RotateCcw size={14} />
        </button>
        <a href={downloadUrl || undefined} target="_blank" rel="noopener noreferrer" className="flex min-h-11 min-w-11 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]" aria-label="Download voice message">
          <Download size={15} />
        </a>
      </div>}
      <audio
        ref={audioRef}
        src={prefetchedUrl || (preloaded ? source : undefined)}
        preload={preloaded || prefetchedUrl ? "auto" : "none"}
        onLoadStart={() => setBuffering(true)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPlaying={() => { setBuffering(false); setPlaying(true); }}
        onPause={() => {
          setPlaying(false);
          deactivateVoiceMessage(audioRef.current);
        }}
        onTimeUpdate={(event) => setCurrentTime(Math.min(duration, event.currentTarget.currentTime))}
        onError={(event) => {
          deactivateVoiceMessage(event.currentTarget);
          setBuffering(false);
          setOffline(typeof navigator !== "undefined" && !navigator.onLine);
          setFailed(true);
        }}
        onEnded={() => {
          setPlaying(false);
          setCurrentTime(0);
          deactivateVoiceMessage(audioRef.current);
          if (nextMessage?.id && nextMessage.senderId === message.senderId && getAudio(nextMessage)?.url) {
            window.setTimeout(() => voicePlayers.get(nextMessage.id)?.(), 0);
          }
        }}
        className="hidden"
      />
      {failed && <div className="sr-only" role="status">Playback failed.</div>}
    </div>
  );
});

export default VoiceMessage;
