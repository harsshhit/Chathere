import { useCallback, useSyncExternalStore } from "react";

const DATA_SAVER_KEY = "chathere:dataSaver";
const mediaKinds = new Set(["image", "audio", "video", "gif"]);
let sessionPreference = null;

const readStoredPreference = () => {
  if (typeof window === "undefined") return sessionPreference;
  try {
    const saved = window.localStorage.getItem(DATA_SAVER_KEY);
    return saved === null ? sessionPreference : saved === "true";
  } catch {
    return sessionPreference;
  }
};

export const getDataSaverDefault = () =>
  typeof navigator !== "undefined" && navigator.connection?.saveData === true;

export const getDataSaverEnabled = () => {
  const stored = readStoredPreference();
  return stored === null ? getDataSaverDefault() : stored;
};

export const shouldAutoLoad = (kind) => {
  if (!mediaKinds.has(kind) || getDataSaverEnabled()) return false;
  if (typeof navigator === "undefined") return true;
  const connection = navigator.connection;
  return connection?.saveData !== true &&
    connection?.effectiveType !== "slow-2g" &&
    connection?.effectiveType !== "2g";
};

const subscribers = new Set();
let removePolicyListeners = null;

const notifyPolicySubscribers = () => subscribers.forEach((listener) => listener());

const getPolicySnapshot = () => {
  const connection = typeof navigator !== "undefined" ? navigator.connection : null;
  return [
    getDataSaverEnabled(),
    connection?.saveData === true,
    connection?.effectiveType || "",
  ].join(":");
};

const subscribeToPolicy = (listener) => {
  subscribers.add(listener);
  if (subscribers.size === 1 && typeof window !== "undefined") {
    const connection = typeof navigator !== "undefined" ? navigator.connection : null;
    window.addEventListener("storage", notifyPolicySubscribers);
    window.addEventListener("chathere:data-saver-change", notifyPolicySubscribers);
    connection?.addEventListener?.("change", notifyPolicySubscribers);
    removePolicyListeners = () => {
      window.removeEventListener("storage", notifyPolicySubscribers);
      window.removeEventListener("chathere:data-saver-change", notifyPolicySubscribers);
      connection?.removeEventListener?.("change", notifyPolicySubscribers);
      removePolicyListeners = null;
    };
  }
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) removePolicyListeners?.();
  };
};

export function useMediaPolicy() {
  const snapshot = useSyncExternalStore(subscribeToPolicy, getPolicySnapshot, getPolicySnapshot);
  const dataSaver = snapshot.split(":")[0] === "true";
  const setDataSaver = useCallback((enabled) => {
    const value = Boolean(enabled);
    try {
      window.localStorage.setItem(DATA_SAVER_KEY, String(value));
      sessionPreference = null;
    } catch (error) {
      sessionPreference = value;
      console.warn("Could not save Data saver preference:", error);
    }
    window.dispatchEvent(new Event("chathere:data-saver-change"));
  }, []);
  return { dataSaver, setDataSaver, shouldAutoLoad };
}
