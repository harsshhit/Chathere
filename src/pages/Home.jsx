import React, { lazy, Suspense, useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Sidebar from "../components/Sidebar";

const Chat = lazy(() => import("../components/Chat"));
const ChatFallback = () => <div className="h-full animate-pulse bg-[var(--surface-2)]" aria-label="Loading conversation" />;

const Home = ({ mobileRootOnly = false }) => {
  const location = useLocation();
  const { chatId } = useParams();
  const shouldReduceMotion = useReducedMotion();

  // Responsive breakpoint hook: < 768px is mobile
  const [isMobile, setIsMobile] = useState(() => {
    return typeof window !== "undefined" ? window.innerWidth < 768 : false;
  });

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const handler = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Track navigation direction: +1 = push (list -> chat), -1 = back (chat -> list)
  const prevPathRef = useRef(location.pathname);
  const directionRef = useRef(1);

  if (location.pathname !== prevPathRef.current) {
    const isEnteringChat = location.pathname.startsWith("/chat/") && prevPathRef.current === "/";
    const isExitingChat = location.pathname === "/" && prevPathRef.current.startsWith("/chat/");

    if (isEnteringChat) {
      directionRef.current = 1;
    } else if (isExitingChat) {
      directionRef.current = -1;
    } else {
      directionRef.current = 1;
    }
    prevPathRef.current = location.pathname;
  }

  const isChatRoute = Boolean(chatId || location.pathname.startsWith("/chat/"));

  // Mobile slide & fade animation variants (only transform and opacity)
  const slideVariants = {
    enter: (direction) => ({
      x: shouldReduceMotion ? 0 : direction > 0 ? "100%" : "-30%",
      opacity: shouldReduceMotion ? 0 : direction > 0 ? 1 : 0.85,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction) => ({
      x: shouldReduceMotion ? 0 : direction > 0 ? "-30%" : "100%",
      opacity: shouldReduceMotion ? 0 : direction > 0 ? 0.85 : 1,
    }),
  };

  const transitionConfig = {
    duration: 0.2,
    ease: [0.32, 0.72, 0, 1],
  };

  return (
    <div
      className="w-full h-full overflow-hidden flex flex-col relative"
      style={{
        background: "var(--surface)",
        height: "var(--app-height, 100dvh)",
      }}
    >
      {isMobile && mobileRootOnly ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <Sidebar />
        </div>
      ) : isMobile ? (
        /* Mobile: single-pane view driven by URL with popLayout slide transition */
        <AnimatePresence mode="popLayout" custom={directionRef.current} initial={false}>
          {isChatRoute ? (
            <motion.div
              key={chatId || "chat-pane"}
              custom={directionRef.current}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transitionConfig}
              className="absolute inset-0 w-full h-full overflow-hidden"
              style={{ willChange: "transform" }}
            >
              <Suspense fallback={<ChatFallback />}><Chat /></Suspense>
            </motion.div>
          ) : (
            <motion.div
              key="list-pane"
              custom={directionRef.current}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={transitionConfig}
              className="absolute inset-0 w-full h-full overflow-hidden"
              style={{ willChange: "transform" }}
            >
              <Sidebar />
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        /* Desktop: Sidebar and Chat / Outlet side-by-side, Sidebar always mounted */
        <div className="flex h-full w-full">
          <div
            className="flex-shrink-0 h-full md:w-[320px] lg:w-[360px] xl:w-[380px]"
            style={{ borderRight: "1px solid var(--border)" }}
          >
            <Sidebar />
          </div>
          <div className="flex-1 h-full min-w-0">
            <Suspense fallback={<ChatFallback />}><Chat /></Suspense>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
