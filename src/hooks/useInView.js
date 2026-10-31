import { useEffect, useRef, useState } from "react";
import { useScrollRoot } from "../context/ScrollRootContext";

const pools = new Map();
const rootIds = new WeakMap();
let nextRootId = 0;

const getPool = (root, rootMargin) => {
  let rootId = "viewport";
  if (root) {
    if (!rootIds.has(root)) {
      rootIds.set(root, `root-${++nextRootId}`);
    }
    rootId = rootIds.get(root);
  }
  const key = `${rootId}:${rootMargin}`;
  if (pools.has(key)) return pools.get(key);
  const subscribers = new Map();
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const callbacks = subscribers.get(entry.target);
      callbacks?.forEach((callback) => callback(entry.isIntersecting));
    });
  }, { root, rootMargin });
  const pool = {
    observe(target, callback) {
      if (!subscribers.has(target)) {
        subscribers.set(target, new Set());
        observer.observe(target);
      }
      subscribers.get(target).add(callback);
    },
    unobserve(target, callback) {
      const callbacks = subscribers.get(target);
      if (!callbacks) return;
      callbacks.delete(callback);
      if (!callbacks.size) {
        subscribers.delete(target);
        observer.unobserve(target);
      }
      if (!subscribers.size) {
        observer.disconnect();
        pools.delete(key);
      }
    },
  };
  pools.set(key, pool);
  return pool;
};

export default function useInView({
  rootMargin = "300px 0px",
  dwellMs = 120,
  once = true,
} = {}) {
  const rootRef = useScrollRoot();
  const elementRef = useRef(null);
  const dwellTimer = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || (once && inView)) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }
    const root = rootRef?.current || null;
    const pool = getPool(root, rootMargin);
    const update = (visible) => {
      window.clearTimeout(dwellTimer.current);
      if (!visible) {
        if (!once) setInView(false);
        return;
      }
      dwellTimer.current = window.setTimeout(() => setInView(true), Math.max(0, dwellMs));
    };
    pool.observe(element, update);
    return () => {
      window.clearTimeout(dwellTimer.current);
      pool.unobserve(element, update);
    };
  }, [dwellMs, inView, once, rootMargin, rootRef]);

  return [elementRef, inView];
}
