import { useEffect } from "react";

/**
 * Hook to manage app viewport height on mobile browsers (specifically iOS Safari
 * and browsers ignoring interactive-widget: resizes-content).
 * Sets --app-height CSS variable on documentElement and resets window scroll.
 */
export function useVisualViewport() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateHeight = () => {
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty("--app-height", `${height}px`);

      // Reset window scroll so page doesn't slide up or get stuck when mobile keyboard opens
      if (window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }
      if (document.body.scrollTop !== 0) {
        document.body.scrollTop = 0;
      }
      if (document.documentElement.scrollTop !== 0) {
        document.documentElement.scrollTop = 0;
      }
    };

    updateHeight();

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateHeight);
      window.visualViewport.addEventListener("scroll", updateHeight);
    }
    window.addEventListener("resize", updateHeight);
    window.addEventListener("orientationchange", updateHeight);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateHeight);
        window.visualViewport.removeEventListener("scroll", updateHeight);
      }
      window.removeEventListener("resize", updateHeight);
      window.removeEventListener("orientationchange", updateHeight);
    };
  }, []);
}

export default useVisualViewport;
