const MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];
const MAX_DURATION_SECONDS = 300;
const WAVEFORM_BARS = 40;
let activeVoiceRecorder = null;

export const isVoiceSupported = () => (
  typeof window !== "undefined" &&
  Boolean(window.isSecureContext) &&
  typeof navigator !== "undefined" &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof MediaRecorder !== "undefined"
);

export const pickMimeType = () => {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return MIME_TYPES.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
};

export const getVoiceFileExtension = (mime = "") => {
  const type = mime.split(";")[0].trim().toLowerCase();
  if (type === "audio/mp4" || type === "video/mp4") return "m4a";
  if (type === "audio/ogg" || type === "application/ogg") return "ogg";
  if (type === "audio/webm" || type === "video/webm") return "webm";
  return "";
};

export const formatVoiceDuration = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
};

export const downsampleVoicePeaks = (samples, count = WAVEFORM_BARS) => {
  const values = Array.isArray(samples) ? samples : [];
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * values.length) / count);
    const end = Math.floor(((index + 1) * values.length) / count);
    const section = values.slice(start, Math.max(start + 1, end));
    const average = section.length ? section.reduce((sum, level) => sum + level, 0) / section.length : 6;
    return Math.max(6, Math.min(100, Math.round(average)));
  });
};

export const getMicrophoneErrorMessage = (error) => {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Microphone is blocked. Allow it in your browser's site settings, then try again.";
    case "NotFoundError":
      return "No microphone was found. Connect a microphone, then try again.";
    case "NotReadableError":
      return "The microphone is busy or unavailable. Close other apps using it, then try again.";
    case "OverconstrainedError":
      return "This microphone cannot use the required recording settings.";
    default:
      return error?.message || "Could not start the microphone. Please try again.";
  }
};

const createAudioContext = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("Audio recording is not supported by this browser.");
  return new AudioContextClass();
};

export class VoiceRecorder {
  constructor({ onTick, onError, onComplete } = {}) {
    this.onTick = onTick;
    this.onError = onError;
    this.onComplete = onComplete;
    this.stream = null;
    this.recorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.chunks = [];
    this.samples = [];
    this.startedAt = 0;
    this.stoppedAt = 0;
    this.lastTickAt = 0;
    this.frameId = null;
    this.sampleInterval = null;
    this.finalizeTimeout = null;
    this.cancelled = false;
    this.finished = false;
    this.stopPromise = null;
    this.stopResolve = null;
    this.trackHandlers = [];
    this.sampleBuffer = null;
  }

  async start() {
    if (activeVoiceRecorder && activeVoiceRecorder !== this) {
      throw new Error("A voice recording is already in progress.");
    }
    if (activeVoiceRecorder === this) return;
    if (this.finished || this.cancelled) {
      throw new Error("This voice recorder session has already ended.");
    }
    if (this.recorder || this.stream) return;
    if (!isVoiceSupported()) {
      throw new Error(typeof window !== "undefined" && window.isSecureContext
        ? "Voice recording is not supported by this browser."
        : "Voice recording requires a secure HTTPS connection.");
    }
    activeVoiceRecorder = this;

    try {
      this.audioContext = createAudioContext();
      const resumeAudio = this.audioContext.resume();
      resumeAudio.catch(() => {});
      if (navigator.permissions?.query) {
        try {
          const permission = await navigator.permissions.query({ name: "microphone" });
          if (permission.state === "denied") {
            const denied = new Error("Microphone is blocked. Allow it in your browser's site settings, then try again.");
            denied.name = "NotAllowedError";
            throw denied;
          }
        } catch (error) {
          if (error?.name === "NotAllowedError") throw error;
        }
      }

      if (this.cancelled) {
        this.release();
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      this.stream = stream;
      if (this.cancelled) {
        this.release();
        return;
      }

      await resumeAudio;
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.sampleBuffer = new Uint8Array(this.analyser.fftSize);
      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      const mimeType = pickMimeType();
      this.recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 32000,
      });
      this.recorder.ondataavailable = (event) => {
        if (!this.cancelled && event.data?.size) this.chunks.push(event.data);
      };
      this.recorder.onstop = () => this.finishRecording();
      this.recorder.onerror = () => {
        this.onError?.("Recording stopped unexpectedly. The captured audio is available to preview.");
        this.stopAutomatically();
      };
      this.trackHandlers = stream.getTracks().map((track) => {
        const handler = () => {
          if (this.cancelled || this.finished) return;
          this.onError?.("The microphone disconnected. The captured audio is available to preview.");
          this.stopAutomatically();
        };
        track.addEventListener("ended", handler);
        return { track, handler };
      });

      this.startedAt = performance.now();
      this.recorder.start(250);
      this.sampleInterval = window.setInterval(() => {
        if (!this.analyser || !this.sampleBuffer || this.finished) return;
        this.analyser.getByteTimeDomainData(this.sampleBuffer);
        let sum = 0;
        for (let index = 0; index < this.sampleBuffer.length; index += 1) {
          const amplitude = (this.sampleBuffer[index] - 128) / 128;
          sum += amplitude * amplitude;
        }
        const level = Math.max(6, Math.min(100, Math.round(Math.sqrt(sum / this.sampleBuffer.length) * 240)));
        this.samples.push(level);
      }, 100);
      this.tick();
    } catch (error) {
      this.release();
      throw new Error(getMicrophoneErrorMessage(error));
    }
  }

  tick = () => {
    if (this.finished || this.cancelled || !this.startedAt) return;
    const now = performance.now();
    const elapsed = Math.min(MAX_DURATION_SECONDS, (now - this.startedAt) / 1000);
    this.analyser?.getByteTimeDomainData(this.sampleBuffer);
    let sum = 0;
    if (this.sampleBuffer) {
      for (let index = 0; index < this.sampleBuffer.length; index += 1) {
        const amplitude = (this.sampleBuffer[index] - 128) / 128;
        sum += amplitude * amplitude;
      }
    }
    const level = this.sampleBuffer?.length
      ? Math.max(6, Math.min(100, Math.round(Math.sqrt(sum / this.sampleBuffer.length) * 240)))
      : 6;
    if (now - this.lastTickAt >= 1000 / 30) {
      this.lastTickAt = now;
      this.onTick?.({ elapsed, level });
    }
    if (elapsed >= MAX_DURATION_SECONDS) {
      this.stopAutomatically();
      return;
    }
    this.frameId = window.requestAnimationFrame(this.tick);
  };

  stopAutomatically = () => {
    this.stop().then((result) => {
      if (result) this.onComplete?.(result);
    }).catch((error) => {
      this.onError?.(getMicrophoneErrorMessage(error));
    });
  };

  stop() {
    if (this.stopPromise) return this.stopPromise;
    if (!this.recorder) {
      return Promise.reject(new Error("There is no active voice recording."));
    }
    this.stoppedAt = performance.now();
    this.stopPromise = new Promise((resolve) => {
      this.stopResolve = resolve;
      try {
        if (this.recorder.state === "inactive") {
          this.finalizeTimeout = window.setTimeout(() => this.finishRecording(), 1000);
        } else {
          this.recorder.stop();
        }
      } catch {
        this.finishRecording();
      }
    });
    return this.stopPromise;
  }

  finishRecording() {
    if (this.finished) return;
    this.finished = true;
    if (this.cancelled) {
      this.release();
      this.stopResolve?.(null);
      return;
    }
    const recorderMime = this.recorder?.mimeType || "";
    const mime = recorderMime || this.chunks.find((chunk) => chunk.type)?.type || "";
    const endTime = this.stoppedAt || performance.now();
    const duration = Math.min(MAX_DURATION_SECONDS, Math.max(0, (endTime - this.startedAt) / 1000));
    const blob = new Blob(this.chunks, { type: mime });
    const result = {
      blob,
      mime: mime || blob.type,
      duration,
      peaks: downsampleVoicePeaks(this.samples),
    };
    this.release();
    this.stopResolve?.(result);
  }

  cancel() {
    this.cancelled = true;
    if (this.recorder && this.recorder.state !== "inactive") {
      try {
        this.recorder.stop();
      } catch {
        // The stream and audio context are still released below.
      }
    }
    this.release();
    this.stopResolve?.(null);
  }

  release() {
    if (this.frameId !== null) window.cancelAnimationFrame(this.frameId);
    if (this.sampleInterval !== null) window.clearInterval(this.sampleInterval);
    if (this.finalizeTimeout !== null) window.clearTimeout(this.finalizeTimeout);
    this.frameId = null;
    this.sampleInterval = null;
    this.finalizeTimeout = null;
    this.trackHandlers.forEach(({ track, handler }) => track.removeEventListener("ended", handler));
    this.trackHandlers = [];
    this.chunks = [];
    this.samples = [];
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.source = null;
    this.analyser = null;
    this.sampleBuffer = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    const context = this.audioContext;
    this.audioContext = null;
    if (context && context.state !== "closed") context.close().catch((error) => {
      console.warn("Could not close voice recording audio context:", error);
    });
    if (this.recorder) {
      this.recorder.ondataavailable = null;
      this.recorder.onstop = null;
      this.recorder.onerror = null;
    }
    this.recorder = null;
    if (activeVoiceRecorder === this) activeVoiceRecorder = null;
  }
}
