import React, { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import useInView from "../../hooks/useInView";
import { buildSrcSet, cloudinaryUrl, placeholderUrl } from "../../utils/cloudinary";
import { useMediaPolicy } from "../../utils/mediaPolicy";
import { getBlobUrl } from "../../utils/mediaCache";

const DEFAULT_WIDTHS = [320, 640, 960];

export default function LazyImage({
  src,
  alt = "",
  width,
  height,
  sizes = "100vw",
  widths = DEFAULT_WIDTHS,
  priority = false,
  className = "",
  onClick,
  onLocalBlob,
  fallbackContent,
  objectFit = "cover",
  style = {},
  manualLoadAction = "button",
}) {
  const [preloadRef, inPreloadZone] = useInView({ rootMargin: "600px 0px", dwellMs: 0 });
  const [imageRef, inView] = useInView({
    rootMargin: priority ? "100px 0px" : "300px 0px",
    dwellMs: priority ? 0 : 120,
  });
  const [manualLoad, setManualLoad] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState("");
  const [offline, setOffline] = useState(false);
  const [placeholderFailed, setPlaceholderFailed] = useState(false);
  const retryTimer = React.useRef(null);
  const { shouldAutoLoad: autoLoadAllowed } = useMediaPolicy();
  const reduceMotion = useReducedMotion();
  const canLoad = autoLoadAllowed("image") || manualLoad || src?.startsWith("blob:") || src?.startsWith("data:");
  const shouldLoad = Boolean(src && inView && canLoad);
  const ratio = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
    ? `${width} / ${height}`
    : "4 / 3";
  const imageSrc = shouldLoad ? cloudinaryUrl(src, { w: widths[widths.length - 1] || 960, q: "auto", fmt: "auto" }) : undefined;
  const displaySrc = imageSrc || (loaded ? loadedSrc : undefined);
  const srcSet = shouldLoad ? buildSrcSet(src, widths) : undefined;
  const placeholder = src ? placeholderUrl(src) : undefined;
  const previewSrc = src && inPreloadZone && placeholder !== src ? placeholder : undefined;

  useEffect(() => {
    setLoaded(false);
    setLoadedSrc("");
    setOffline(false);
    setFailed(false);
    setAttempt(0);
    setManualLoad(false);
  }, [src]);
  useEffect(() => {
    const retryWhenOnline = () => {
      if (!shouldLoad) return;
      setOffline(false);
      setFailed(false);
      setAttempt((value) => value + 1);
    };
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [shouldLoad]);
  useEffect(() => () => window.clearTimeout(retryTimer.current), []);

  const handleError = () => {
    setLoaded(false);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
      return;
    }
    if (attempt < 2) {
      retryTimer.current = window.setTimeout(
        () => setAttempt((value) => value + 1),
        attempt === 0 ? 1000 : 3000
      );
    }
    else setFailed(true);
  };

  const retry = (event) => {
    event.stopPropagation();
    window.clearTimeout(retryTimer.current);
    setAttempt(0);
    setFailed(false);
    setLoaded(false);
    setManualLoad(true);
    setOffline(false);
  };
  const handleContainerClick = (event) => {
    if (manualLoadAction === "container" && src) {
      if (failed) {
        if (!fallbackContent) retry(event);
        return;
      }
      if (!canLoad) {
        event.stopPropagation();
        setManualLoad(true);
        return;
      }
    }
    onClick?.(event);
  };

  return (
    <div
      ref={(node) => {
        preloadRef.current = node;
        imageRef.current = node;
      }}
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: ratio, ...style }}
      onClick={handleContainerClick}
      role={!displaySrc && alt && !fallbackContent && canLoad && !failed ? "img" : undefined}
      aria-label={!displaySrc && alt && !fallbackContent && canLoad && !failed ? alt : undefined}
    >
      {!loaded && <span className={`absolute inset-0 ${reduceMotion ? "" : "animate-pulse"} bg-[var(--surface-3)]`} aria-hidden="true" />}
      {previewSrc && !placeholderFailed && !loaded && <img
        src={previewSrc}
        alt=""
        aria-hidden="true"
        onError={() => setPlaceholderFailed(true)}
        className="absolute inset-0 h-full w-full object-cover blur-sm"
        style={{ filter: "blur(5px)", transform: "scale(1.05)", objectFit }}
      />}
      {displaySrc && !failed && <img
        key={attempt}
        src={displaySrc}
        srcSet={shouldLoad ? srcSet : undefined}
        sizes={shouldLoad ? sizes : undefined}
        alt={alt}
        width={width}
        height={height}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => {
          window.clearTimeout(retryTimer.current);
          setLoaded(true);
          setOffline(false);
          setLoadedSrc(imageSrc || displaySrc);
          if (displaySrc.startsWith("blob:")) {
            onLocalBlob?.(displaySrc);
          } else if (onLocalBlob && imageSrc) {
            getBlobUrl(imageSrc).then((localUrl) => {
              if (localUrl.startsWith("blob:")) onLocalBlob(localUrl);
            }).catch((error) => console.warn("Could not cache local sent image:", error));
          }
        }}
        onError={handleError}
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: loaded ? 1 : 0,
          transition: reduceMotion ? "none" : "opacity 200ms ease",
          objectFit,
        }}
      />}
      {failed && fallbackContent}
      {failed && !fallbackContent && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--surface-2)] p-2 text-center text-xs text-[var(--text-secondary)]">
        <span>Image unavailable</span>
        {manualLoadAction === "container"
          ? <span className="font-semibold text-[var(--primary-text)]">Retry</span>
          : <button type="button" onClick={retry} className="min-h-11 rounded-lg px-3 font-semibold text-[var(--primary-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">Retry</button>}
      </div>}
      {!canLoad && inView && !failed && !loaded && <div className="absolute inset-x-1 bottom-1 flex justify-center">
        {manualLoadAction === "container"
          ? <span className="flex min-h-11 items-center rounded-full bg-black/70 px-3 text-xs font-semibold text-white">Tap to load</span>
          : <button type="button" onClick={(event) => { event.stopPropagation(); setManualLoad(true); }} className="min-h-11 rounded-full bg-black/70 px-3 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Tap to load</button>}
      </div>}
      {offline && !loaded && <span className="absolute inset-x-1 top-1 rounded-full bg-black/70 px-2 py-1 text-center text-xs text-white">Offline</span>}
    </div>
  );
}
