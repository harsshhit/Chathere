if (process.env.NODE_ENV !== "production" && typeof PerformanceObserver !== "undefined") {
  const observe = (type, callback) => {
    try {
      const observer = new PerformanceObserver((list) => callback(list.getEntries()));
      observer.observe({ type, buffered: true, ...(type === "event" ? { durationThreshold: 50 } : {}) });
    } catch {
      return;
    }
  };

  observe("largest-contentful-paint", (entries) => {
    entries.forEach((entry) => console.info("[perf] LCP", Math.round(entry.startTime), "ms"));
  });

  let cumulativeLayoutShift = 0;
  observe("layout-shift", (entries) => {
    entries.forEach((entry) => {
      if (!entry.hadRecentInput) cumulativeLayoutShift += entry.value;
    });
    console.info("[perf] CLS", cumulativeLayoutShift);
  });

  const supportedTypes = PerformanceObserver.supportedEntryTypes || [];
  const interactionType = supportedTypes.includes("event") ? "event" : "longtask";
  observe(interactionType, (entries) => {
    entries.forEach((entry) => {
      if (entry.duration > 50 && (interactionType === "longtask" || entry.interactionId)) {
        console.info("[perf] long interaction", entry.name, Math.round(entry.duration), "ms");
      }
    });
  });
}
