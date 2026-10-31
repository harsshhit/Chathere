import React, { useEffect, useRef, useState } from "react";
import useInView from "../../hooks/useInView";
import { posterUrl } from "../../utils/cloudinary";
import { useMediaPolicy } from "../../utils/mediaPolicy";
import LazyImage from "./LazyImage";
import { useReducedMotion } from "framer-motion";

export default function LazyVideo({
  src,
  poster,
  width,
  height,
  alternateSrc,
  startOnMount = false,
  ariaLabel,
  className = "",
  autoPlayInView = false,
  kind = "video",
}) {
  const [ref, inView] = useInView({ rootMargin: "200px 0px", dwellMs: 120, once: false });
  const [activated, setActivated] = useState(startOnMount);
  const [offline, setOffline] = useState(false);
  const videoRef = useRef(null);
  const { shouldAutoLoad: autoLoadAllowed } = useMediaPolicy();
  const reduceMotion = useReducedMotion();
  const autoLoad = autoLoadAllowed(kind);
  const visibleAutoPlay = autoPlayInView && inView && autoLoad && !reduceMotion;
  const shouldLoad = activated || visibleAutoPlay;
  const posterSrc = poster || posterUrl(src, width || 640);
  const usePosterFallback = autoPlayInView && (!autoLoad || reduceMotion);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !autoPlayInView) return undefined;
    if (visibleAutoPlay && document.visibilityState === "visible") {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    return undefined;
  }, [autoPlayInView, visibleAutoPlay, src]);

  useEffect(() => {
    if (!autoPlayInView && activated) videoRef.current?.play().catch(() => {});
  }, [activated, autoPlayInView]);

  useEffect(() => {
    if (!autoPlayInView) return undefined;
    const onVisibilityChange = () => {
      const video = videoRef.current;
      if (!video) return;
      if (document.visibilityState === "hidden") video.pause();
      else if (visibleAutoPlay) video.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [autoPlayInView, visibleAutoPlay]);
  useEffect(() => {
    const retryWhenOnline = () => {
      setOffline(false);
      if (!activated && !autoPlayInView) return;
      const video = videoRef.current;
      if (!video) return;
      video.load();
      if (autoPlayInView && visibleAutoPlay) video.play().catch(() => {});
    };
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [activated, autoPlayInView, visibleAutoPlay]);

  if (usePosterFallback) {
    return <LazyImage src={posterSrc} alt="" width={width} height={height} className={className} />;
  }

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? `${width} / ${height}` : "4 / 3" }}
    >
      <video
        ref={videoRef}
        poster={inView ? posterSrc : undefined}
        preload="none"
        muted={autoPlayInView}
        loop={autoPlayInView}
        playsInline
        controls={activated && !autoPlayInView}
        aria-label={ariaLabel || (autoPlayInView ? "Animated GIF" : "Video attachment")}
        onError={() => setOffline(typeof navigator !== "undefined" && !navigator.onLine)}
        className="absolute inset-0 h-full w-full object-cover"
      >
        {shouldLoad && <source src={src} />}
        {shouldLoad && alternateSrc && <source src={alternateSrc} />}
      </video>
      {!autoPlayInView && !activated && <button
        type="button"
        onClick={() => setActivated(true)}
        className="absolute inset-0 flex items-center justify-center bg-black/15 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
        aria-label="Load video"
      >
        <span className="rounded-full bg-black/60 px-4 py-2 text-sm font-semibold">Play video</span>
      </button>}
      {offline && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-xs text-white">Offline</span>}
    </div>
  );
}
