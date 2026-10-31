import { useCallback, useEffect, useRef, useState } from "react";

export default function useCopyToClipboard(duration = 1500) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const copyText = useCallback(async (value) => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), duration);
    } catch (error) {
      console.error("Could not copy text to clipboard:", error);
    }
  }, [duration]);

  return { copied, copyText };
}
