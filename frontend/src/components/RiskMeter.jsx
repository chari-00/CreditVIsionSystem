// CreditVision — RiskMeter Neon-Arc Gauge
// Premium SVG implementation with segmented arcs and neon glow
import { useEffect, useRef, useState } from 'react';

const BANDS = [
  { min: 300, max: 450,  color: '#FF3B4E', label: 'CRITICAL', short: 'CRIT' },
  { min: 450, max: 600,  color: '#FF8A1A', label: 'HIGH',     short: 'HIGH' },
  { min: 600, max: 700,  color: '#F5C518', label: 'MEDIUM',   short: 'MED' },
  { min: 700, max: 850,  color: '#02B946', label: 'LOW',      short: 'LOW' },
  { min: 850, max: 1000, color: '#02E85A', label: 'OPTIMAL',  short: 'OPT' },
];

function polarToCart(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Draw a bold arc segment
function discArc(cx, cy, rOut, rIn, startDeg, endDeg) {
  const sLimit = polarToCart(cx, cy, rOut, startDeg);
  const eLimit = polarToCart(cx, cy, rOut, endDeg);
  const sBase  = polarToCart(cx, cy, rIn,  startDeg);
  const eBase  = polarToCart(cx, cy, rIn,  endDeg);
  const large  = endDeg - startDeg > 180 ? 1 : 0;

  return `
    M ${sLimit.x} ${sLimit.y}
    A ${rOut} ${rOut} 0 ${large} 1 ${eLimit.x} ${eLimit.y}
    L ${eBase.x} ${eBase.y}
    A ${rIn} ${rIn} 0 ${large} 0 ${sBase.x} ${sBase.y}
    Z
  `;
}

function getColor(score) {
  const band = BANDS.find(b => score >= b.min && score < b.max) || BANDS[BANDS.length-1];
  return band.color;
}

function getLabel(score) {
  const band = BANDS.find(b => score >= b.min && score < b.max) || BANDS[BANDS.length-1];
  return band.label;
}

const CX = 150, CY = 140, R_OUT = 120, R_IN = 95, GAP = 2.5;

export default function RiskMeter({ score = 0, pdValue = null, size = 300 }) {
  const [animScore, setAnimScore] = useState(300);
  const raf = useRef(null);

  useEffect(() => {
    let start = null;
    const from = animScore;
    const to   = Math.min(1000, Math.max(300, score));
    const dur  = 1000;

    const step = (ts) => {
      if (!start) start = ts;
      const prog = Math.min(1, (ts - start) / dur);
      const eased = prog === 1 ? 1 : 1 - Math.pow(2, -10 * prog);
      setAnimScore(Math.round(from + (to - from) * eased));
      if (prog < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [score]);

  const activeColor = getColor(animScore);
  const activeLabel = getLabel(animScore);
  const angle = ((animScore - 300) / 700) * 180; // 0 to 180 degrees
  const needlePos = polarToCart(CX, CY, R_OUT - 10, angle);

  return (
    <div style={{ position: 'relative', display: 'inline-block', filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.2))' }}>
      <svg viewBox="0 0 300 170" width={size} height={size * 0.57} style={{ overflow: 'visible' }}>
        <defs>
          <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="needle-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={activeColor} stopOpacity="1" />
            <stop offset="100%" stopColor={activeColor} stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Gray Background Track */}
        <path
          d={discArc(CX, CY, R_OUT, R_IN, 0, 180)}
          fill="var(--bg-secondary, #222)"
          opacity="0.2"
        />

        {/* Segmented Arcs */}
        {BANDS.map((b, i) => {
          const sDeg = ((b.min - 300) / 700) * 180;
          const eDeg = ((Math.min(b.max, 1000) - 300) / 700) * 180;
          const isActive = animScore >= b.min;
          const isCurrent = animScore >= b.min && animScore < b.max;
          
          return (
            <g key={b.label} filter={isActive ? "url(#neon-glow)" : "none"}>
              <path
                d={discArc(CX, CY, R_OUT, R_IN, sDeg + GAP, eDeg - GAP)}
                fill={isActive ? b.color : "rgba(255,255,255,0.05)"}
                style={{ transition: 'fill 0.4s ease' }}
              />
              {/* Scale Labels */}
              <text
                x={polarToCart(CX, CY, R_OUT + 18, (sDeg + eDeg) / 2).x}
                y={polarToCart(CX, CY, R_OUT + 18, (sDeg + eDeg) / 2).y}
                textAnchor="middle"
                fontSize="8"
                fontWeight="800"
                fill={isActive ? b.color : "var(--text-muted)"}
                style={{ transition: 'fill 0.4s' }}
                fontFamily="var(--font-mono)"
              >
                {b.short}
              </text>
            </g>
          );
        })}

        {/* Tick Marks & Boundary Values */}
        {[300, 450, 600, 700, 850, 1000].map(v => {
          const a = ((v - 300) / 700) * 180;
          const p1 = polarToCart(CX, CY, R_IN - 5, a);
          const p2 = polarToCart(CX, CY, R_OUT + 5, a);
          return (
            <g key={`v-${v}`}>
              <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <text
                x={polarToCart(CX, CY, R_IN - 12, a).x}
                y={polarToCart(CX, CY, R_IN - 12, a).y}
                textAnchor="middle"
                fontSize="7"
                fill="var(--text-muted)"
                fontFamily="var(--font-mono)"
              >{v}</text>
            </g>
          );
        })}

        {/* Needle */}
        <line
          x1={CX} y1={CY}
          x2={needlePos.x} y2={needlePos.y}
          stroke={activeColor}
          strokeWidth="3"
          strokeLinecap="round"
          filter="url(#neon-glow)"
          style={{ transition: 'all 0.1s linear' }}
        />
        <circle cx={CX} cy={CY} r="6" fill={activeColor} filter="url(#neon-glow)" />
        <circle cx={CX} cy={CY} r="3" fill="#000" />

        {/* Central Display */}
        <text
          x={CX} y={CY - 15}
          textAnchor="middle"
          fill="white"
          style={{ fontSize: 42, fontWeight: 900, fontFamily: 'var(--font-mono)', filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.4))' }}
        >
          {animScore}
        </text>

        {/* Band Label - moved lower */}
        <text
          x={CX} y={CY + 15}
          textAnchor="middle"
          fill={activeColor}
          style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', filter: `drop-shadow(0 0 5px ${activeColor})` }}
        >
          {activeLabel}
        </text>

        {/* PD Value - moved lower */}
        {pdValue !== null && (
          <text
            x={CX} y={CY + 35}
            textAnchor="middle"
            fill="var(--text-muted)"
            style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-mono)' }}
          >
            PD: {(pdValue * 100).toFixed(2)}%
          </text>
        )}
      </svg>
    </div>
  );
}

export { getColor, getLabel };
