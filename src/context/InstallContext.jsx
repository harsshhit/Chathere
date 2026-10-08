import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export const InstallContext = createContext({
  canInstall: false,
  isInstalled: false,
  promptInstall: async () => false,
  isIOS: false,
});

export const useInstall = () => useContext(InstallContext);

export const InstallProvider = ({ children }) => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOSDevice, setIsIOSDevice] = useState(false);

  // Check standalone mode and iOS device on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true ||
        document.referrer.includes("android-app://");
      setIsInstalled(isStandaloneMode);
    };

    checkStandalone();

    const mql = window.matchMedia("(display-mode: standalone)");
    const handleMqlChange = (e) => setIsInstalled(e.matches);
    mql.addEventListener("change", handleMqlChange);

    // iOS detection
    const isIOS =
      (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) &&
      !window.MSStream;
    setIsIOSDevice(Boolean(isIOS));

    // Capture beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      mql.removeEventListener("change", handleMqlChange);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choiceResult.outcome === "accepted") {
        setIsInstalled(true);
        return true;
      }
      return false;
    } catch (err) {
      console.warn("Install prompt failed:", err);
      return false;
    }
  }, [deferredPrompt]);

  const canInstall = Boolean(deferredPrompt) && !isInstalled;

  return (
    <InstallContext.Provider
      value={{
        canInstall,
        isInstalled,
        promptInstall,
        isIOS: isIOSDevice,
      }}
    >
      {children}
    </InstallContext.Provider>
  );
};

export default InstallContext;
