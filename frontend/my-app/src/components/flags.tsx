// Corridor flags: small simplified national/regional flags for the
// Employment guidance destination markers. Simplified for legibility at
// ~20px (fine detail such as star points is reduced to dots), each on a
// rounded chip with a theme-aware ring so light flags stay visible in
// both themes. Decorative duplicates of the adjacent destination name,
// so aria-hidden; the name text remains the accessible label.

import { useId, type JSX } from "react";
import type { CorridorCode } from "@/lib/corridors";

/** Simplified Union Jack fitted to a box (full flags and cantons). */
function Jack({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <g>
      <line x1={x} y1={y} x2={x + w} y2={y + h} stroke="#ffffff" strokeWidth={h / 3.2} />
      <line x1={x + w} y1={y} x2={x} y2={y + h} stroke="#ffffff" strokeWidth={h / 3.2} />
      <line x1={x} y1={y} x2={x + w} y2={y + h} stroke="#C8102E" strokeWidth={h / 8} />
      <line x1={x + w} y1={y} x2={x} y2={y + h} stroke="#C8102E" strokeWidth={h / 8} />
      <rect x={x} y={cy - h / 5} width={w} height={(2 * h) / 5} fill="#ffffff" />
      <rect x={cx - w / 9} y={y} width={(2 * w) / 9} height={h} fill="#ffffff" />
      <rect x={x} y={cy - h / 8.5} width={w} height={(2 * h) / 8.5} fill="#C8102E" />
      <rect x={cx - w / 15} y={y} width={(2 * w) / 15} height={h} fill="#C8102E" />
    </g>
  );
}

function FlagGB() {
  return (
    <g>
      <rect width="20" height="14" fill="#012169" />
      <Jack x={0} y={0} w={20} h={14} />
    </g>
  );
}

function FlagID() {
  return (
    <g>
      <rect width="20" height="14" fill="#ffffff" />
      <rect width="20" height="7" fill="#E70011" />
    </g>
  );
}

function FlagMY() {
  return (
    <g>
      <rect width="20" height="14" fill="#ffffff" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={i * 2} width="20" height="1" fill="#CC0001" />
      ))}
      <rect width="10" height="8" fill="#010066" />
      <circle cx="4.4" cy="4" r="2.4" fill="#FFCC00" />
      <circle cx="5.4" cy="4" r="2" fill="#010066" />
      <circle cx="7.6" cy="4" r="0.9" fill="#FFCC00" />
    </g>
  );
}

function FlagSG() {
  return (
    <g>
      <rect width="20" height="14" fill="#ffffff" />
      <rect width="20" height="7" fill="#EF3340" />
      <circle cx="4.6" cy="3.5" r="2.6" fill="#ffffff" />
      <circle cx="5.7" cy="3.5" r="2.2" fill="#EF3340" />
      {[
        [8.6, 1.7],
        [9.8, 2.8],
        [8.1, 3],
        [9.3, 4.1],
        [8.1, 5.2],
      ].map(([sx, sy]) => (
        <circle key={`${sx},${sy}`} cx={sx} cy={sy} r="0.5" fill="#ffffff" />
      ))}
    </g>
  );
}

function FlagJP() {
  return (
    <g>
      <rect width="20" height="14" fill="#ffffff" />
      <circle cx="10" cy="7" r="3.4" fill="#BC002D" />
    </g>
  );
}

function FlagAU() {
  return (
    <g>
      <rect width="20" height="14" fill="#00247D" />
      <Jack x={0} y={0} w={10} h={7} />
      <circle cx="5" cy="10.8" r="1.1" fill="#ffffff" />
      {[
        [15, 2.4],
        [15, 11],
        [12.6, 6.7],
        [17.4, 6.7],
        [13.9, 9.2],
      ].map(([sx, sy]) => (
        <circle key={`${sx},${sy}`} cx={sx} cy={sy} r="0.7" fill="#ffffff" />
      ))}
    </g>
  );
}

function FlagNZ() {
  return (
    <g>
      <rect width="20" height="14" fill="#00247D" />
      <Jack x={0} y={0} w={10} h={7} />
      {[
        [15, 2.4],
        [15, 11],
        [12.6, 6.7],
        [17.4, 6.7],
      ].map(([sx, sy]) => (
        <circle
          key={`${sx},${sy}`}
          cx={sx}
          cy={sy}
          r="0.9"
          fill="#CC142B"
          stroke="#ffffff"
          strokeWidth="0.5"
        />
      ))}
    </g>
  );
}

function FlagTW() {
  return (
    <g>
      <rect width="20" height="14" fill="#FE0000" />
      <rect width="10" height="7" fill="#000095" />
      <circle cx="5" cy="3.5" r="1.1" fill="#ffffff" />
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i * Math.PI) / 4;
        return (
          <line
            key={i}
            x1={5 + Math.cos(angle) * 1.4}
            y1={3.5 + Math.sin(angle) * 1.4}
            x2={5 + Math.cos(angle) * 2.2}
            y2={3.5 + Math.sin(angle) * 2.2}
            stroke="#ffffff"
            strokeWidth="0.45"
          />
        );
      })}
    </g>
  );
}

function FlagHK() {
  return (
    <g>
      <rect width="20" height="14" fill="#DE2910" />
      {Array.from({ length: 5 }, (_, i) => (
        <ellipse
          key={i}
          cx="10"
          cy="4.6"
          rx="1.15"
          ry="2.3"
          fill="#ffffff"
          transform={`rotate(${i * 72} 10 7)`}
        />
      ))}
      <circle cx="10" cy="7" r="0.8" fill="#DE2910" />
    </g>
  );
}

const FLAGS: Record<CorridorCode, () => JSX.Element> = {
  GB: FlagGB,
  ID: FlagID,
  MY: FlagMY,
  SG: FlagSG,
  JP: FlagJP,
  AU: FlagAU,
  NZ: FlagNZ,
  TW: FlagTW,
  HK: FlagHK,
};

export function CorridorFlag({
  code,
  className = "",
}: {
  code: CorridorCode;
  className?: string;
}) {
  // Sanitized: useId colons are invalid in url() fragment references.
  const clipId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const Flag = FLAGS[code];
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 20 14"
      className={`shrink-0 ${className}`}
    >
      <defs>
        <clipPath id={clipId}>
          <rect width="20" height="14" rx="2.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <Flag />
      </g>
      <rect
        x="0.5"
        y="0.5"
        width="19"
        height="13"
        rx="2"
        fill="none"
        strokeWidth="1"
        className="stroke-edge"
      />
    </svg>
  );
}
