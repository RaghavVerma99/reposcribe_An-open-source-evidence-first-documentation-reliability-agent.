/** A stylised, SVG-rendered floating card stack with annotation tags.
 * Replaces the 3D isometric artwork of the reference so we keep the same
 * visual rhythm (depth, glowing tags, indigo-violet stage) without raster art.
 */
export default function FeaturedIllustration() {
  return (
    <div className="relative aspect-[5/4] w-full">
      <svg
        viewBox="0 0 500 400"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="stage" cx="50%" cy="55%" r="48%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#8b5cf6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0a0c1a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1c2046" />
            <stop offset="100%" stopColor="#101229" />
          </linearGradient>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="500" height="400" fill="url(#stage)" />

        {/* Floating card 1 — back */}
        <g transform="translate(220 60) rotate(-8)" filter="url(#glow)">
          <rect width="190" height="120" rx="14" fill="url(#cardGrad)" stroke="#2d3470" strokeWidth="1" />
          <rect x="14" y="14" width="140" height="6" rx="3" fill="#7c7ff5" opacity="0.8" />
          <rect x="14" y="28" width="100" height="4" rx="2" fill="#2d3470" />
          {Array.from({ length: 6 }).map((_, idx) => (
            <rect
              key={idx}
              x="14"
              y={42 + idx * 10}
              width={120 - idx * 6}
              height="3"
              rx="1.5"
              fill={idx % 2 === 0 ? "#1f2444" : "#2d3470"}
            />
          ))}
        </g>

        {/* Floating card 2 — middle */}
        <g transform="translate(150 130) rotate(4)" filter="url(#glow)">
          <rect width="200" height="120" rx="14" fill="url(#cardGrad)" stroke="#2d3470" strokeWidth="1" />
          <rect x="14" y="14" width="60" height="6" rx="3" fill="#22d3ee" opacity="0.85" />
          <rect x="14" y="28" width="120" height="4" rx="2" fill="#2d3470" />
          {Array.from({ length: 6 }).map((_, idx) => (
            <rect
              key={idx}
              x="14"
              y={42 + idx * 10}
              width={140 - idx * 10}
              height="3"
              rx="1.5"
              fill={idx % 2 === 0 ? "#1f2444" : "#2d3470"}
            />
          ))}
        </g>

        {/* Floating card 3 — front */}
        <g transform="translate(110 220) rotate(-3)" filter="url(#glow)">
          <rect width="220" height="130" rx="14" fill="url(#cardGrad)" stroke="#7c7ff5" strokeOpacity="0.45" strokeWidth="1" />
          <rect x="14" y="14" width="100" height="8" rx="4" fill="#c4b9ff" opacity="0.9" />
          <rect x="14" y="30" width="140" height="4" rx="2" fill="#2d3470" />
          {Array.from({ length: 7 }).map((_, idx) => (
            <rect
              key={idx}
              x="14"
              y={46 + idx * 11}
              width={150 - idx * 8}
              height="3"
              rx="1.5"
              fill={idx % 2 === 0 ? "#1f2444" : "#2d3470"}
            />
          ))}
          <circle cx="186" cy="98" r="14" fill="#10b981" opacity="0.12" />
          <path
            d="m180 98 4 4 6-7"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Annotation tags with thin connectors */}
        <Tag x={28} y={92} dot="#7c7ff5" text="Detect drift" />
        <Tag x={438} y={68} dot="#22d3ee" text="Find evidence" />
        <Tag x={452} y={204} dot="#f59e0b" text="Propose fixes" />
        <Tag x={40} y={314} dot="#10b981" text="Verify changes" />
      </svg>

      <div className="relative h-full">
        <div className="pointer-events-none absolute inset-0" />
      </div>
    </div>
  );
}

function Tag({
  x,
  y,
  dot,
  text,
}: {
  x: number;
  y: number;
  dot: string;
  text: string;
}) {
  // Convert SVG viewBox coords into percentages for HTML placement.
  const leftPct = (x / 500) * 100;
  const topPct = (y / 400) * 100;
  return (
    <div
      className="absolute"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="flex items-center gap-2 rounded-full border border-line bg-surface/85 px-3 py-1.5 text-[12px] font-medium text-ink shadow-accent backdrop-blur">
        <span
          aria-hidden="true"
          className="grid h-4 w-4 place-items-center rounded-full border bg-surface"
          style={{ borderColor: dot }}
        >
          <span
            aria-hidden="true"
            className="h-1 w-1 rounded-full"
            style={{ background: dot, boxShadow: `0 0 6px ${dot}` }}
          />
        </span>
        {text}
      </div>
    </div>
  );
}