import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, RefreshCw, Image } from "lucide-react";
import { searchGifs, trendingGifs } from "../services/gifs";

// How many tiles to show per load (max 50 per Klipy docs)
const PER_PAGE = 20;
// Debounce delay before firing search
const DEBOUNCE_MS = 400;

// ── Skeleton tile ────────────────────────────────────────────────────────────
const SkeletonTile = () => (
  <div
    className="rounded-xl overflow-hidden"
    style={{
      paddingBottom: "75%",
      position: "relative",
      background: "var(--surface-3)",
    }}
  >
    <div
      className="shimmer absolute inset-0"
      aria-hidden="true"
    />
  </div>
);

// ── GIF Picker component ──────────────────────────────────────────────────────
const GifPicker = ({ onGifSelect }) => {
  const [gifs, setGifs] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nextPage, setNextPage] = useState(null);

  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const bottomRef = useRef(null);
  const listRef = useRef(null);

  // Core fetch: initial load (page 1)
  const fetchGifs = useCallback(async (query, page = 1) => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    const isFirstPage = page === 1;
    if (isFirstPage) {
      setLoading(true);
      setError(null);
      setGifs([]);
      setNextPage(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const result = query.trim()
        ? await searchGifs(query, { limit: PER_PAGE, page, signal: abortRef.current.signal })
        : await trendingGifs({ limit: PER_PAGE, page, signal: abortRef.current.signal });

      setGifs((prev) => (isFirstPage ? result.items : [...prev, ...result.items]));
      setNextPage(result.nextPage);
    } catch (err) {
      if (err.name === "AbortError") return; // stale – ignore
      setError(err.message || "Failed to load GIFs");
    } finally {
      if (isFirstPage) setLoading(false);
      else setLoadingMore(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    fetchGifs("");
    return () => { if (abortRef.current) abortRef.current.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchGifs(searchTerm);
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Infinite scroll via IntersectionObserver on a sentinel div
  useEffect(() => {
    if (!bottomRef.current || !nextPage || loadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextPage && !loadingMore) {
          fetchGifs(searchTerm, nextPage);
        }
      },
      { root: listRef.current, threshold: 0.1 }
    );
    observer.observe(bottomRef.current);
    return () => observer.disconnect();
  }, [nextPage, loadingMore, searchTerm, fetchGifs]);

  const handleRetry = () => fetchGifs(searchTerm);

  return (
    <div
      className="flex flex-col rounded-xl overflow-hidden"
      style={{
        width: "300px",
        height: "380px",
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        boxShadow: "0 20px 60px var(--shadow)",
      }}
    >
      {/* ── Search header ── */}
      <div className="p-3 pb-2 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            type="text"
            // KLIPY required attribution: placeholder must be "Search KLIPY"
            placeholder="Search KLIPY"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search KLIPY GIFs"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg outline-none"
            style={{
              background: "var(--surface-3)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          />
        </div>
      </div>

      {/* ── Content area ── */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-2 custom-scrollbar"
        style={{ overscrollBehavior: "contain" }}
      >
        {/* Error state */}
        {error && !loading && (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4">
            <Image size={28} style={{ color: "var(--text-muted)" }} />
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {error}
            </p>
            <button
              onClick={handleRetry}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{
                background: "rgba(99,102,241,0.15)",
                color: "var(--primary-light)",
                border: "1px solid rgba(99,102,241,0.3)",
              }}
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonTile key={i} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && gifs.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-center px-4" style={{ color: "var(--text-muted)" }}>
              No GIFs found for "{searchTerm}"
            </p>
          </div>
        )}

        {/* GIF grid */}
        {!loading && gifs.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onGifSelect(gif.url)}
                className="rounded-xl overflow-hidden cursor-pointer transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 touch-action-manipulation"
                style={{
                  position: "relative",
                  paddingBottom: `${(gif.height / gif.width) * 100}%`,
                  background: "var(--surface-3)",
                }}
                aria-label={`Send GIF`}
              >
                <img
                  src={gif.previewUrl}
                  alt="GIF"
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                  style={{ display: "block" }}
                />
              </button>
            ))}

            {/* Load-more trigger (infinite scroll sentinel) */}
            {nextPage && (
              <div
                ref={bottomRef}
                className="col-span-2 flex justify-center py-2"
              >
                {loadingMore && (
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <SkeletonTile key={`more-${i}`} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Klipy attribution (optional but shown for good practice) ── */}
      <div
        className="flex-shrink-0 px-3 py-1.5 flex items-center justify-end"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span
          className="text-[9px] font-medium tracking-wide"
          style={{ color: "var(--text-muted)", opacity: 0.7 }}
        >
          Powered by KLIPY
        </span>
      </div>
    </div>
  );
};

export default GifPicker;
