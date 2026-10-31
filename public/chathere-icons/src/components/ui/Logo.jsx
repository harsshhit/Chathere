import { useId } from "react";

// ChatHere mark: a speech drop (one sharp corner) with a notification dot.
// variant="mark": transparent, for headers and inline use.
// variant="tile": the full app-icon tile, for splash, login and empty states.
const BUBBLE =
  "M120 396V220A96 96 0 0 1 216 124H296A96 96 0 0 1 392 220V300A96 96 0 0 1 296 396Z";
const DOT = { cx: 372, cy: 144, r: 34, gap: 14 };

export default function Logo({
  size = 32,
  variant = "mark",
  title = "ChatHere",
  className,
}) {
  const uid = useId().replace(/:/g, "");
  const orange = `logo-or-${uid}`;
  const cut = `logo-cut-${uid}`;
  const bg = `logo-bg-${uid}`;
  const glow = `logo-glow-${uid}`;
  const isTile = variant === "tile";
  const a11y = title
    ? { role: "img", "aria-label": title }
    : { "aria-hidden": true, focusable: "false" };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={isTile ? "0 0 512 512" : "100 90 320 320"}
      width={size}
      height={size}
      className={className}
      {...a11y}
    >
      <defs>
        <linearGradient id={orange} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#FF9B57" />
          <stop offset="0.5" stopColor="#F2732B" />
          <stop offset="1" stopColor="#DE5A12" />
        </linearGradient>
        <mask id={cut} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
          <rect width="512" height="512" fill="#fff" />
          <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r + DOT.gap} fill="#000" />
        </mask>
        {isTile && (
          <>
            <linearGradient id={bg} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5B3B2F" />
              <stop offset="0.45" stopColor="#2A1B16" />
              <stop offset="1" stopColor="#0E0A09" />
            </linearGradient>
            <radialGradient id={glow} cx="0.5" cy="0.52" r="0.5">
              <stop offset="0" stopColor="#F2732B" stopOpacity="0.26" />
              <stop offset="1" stopColor="#F2732B" stopOpacity="0" />
            </radialGradient>
          </>
        )}
      </defs>
      {isTile && (
        <>
          <rect width="512" height="512" rx="112" fill={`url(#${bg})`} />
          <circle cx="256" cy="262" r="240" fill={`url(#${glow})`} />
        </>
      )}
      <g transform={isTile ? "translate(256 260) scale(1.06) translate(-256 -260)" : undefined}>
        <path d={BUBBLE} fill={`url(#${orange})`} mask={`url(#${cut})`} />
        <circle cx={DOT.cx} cy={DOT.cy} r={DOT.r} fill="#F6EFE9" />
      </g>
    </svg>
  );
}
