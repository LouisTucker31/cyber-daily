/* Level ring, skill rings and badge medals, drawn in SVG so they stay crisp and themeable. */

/* Progress ring with a number in the middle. Fills with an animation when it appears,
   unless animate is false. */
export function LevelRing({ level, progress, size = 44, animate = true }:
  { level: number; progress: number; size?: number; animate?: boolean }) {
  const p = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <svg className={'level-ring' + (animate ? '' : ' no-intro')} viewBox="0 0 48 48" width={size} height={size} aria-label={`Level ${level}`}>
      <circle cx="24" cy="24" r="20" className="ring-track" />
      <circle cx="24" cy="24" r="20" className="ring-fill" pathLength={100}
        strokeDasharray={`${p} 100`} transform="rotate(-90 24 24)" />
      <text x="24" y="24" className="ring-num" textAnchor="middle" dominantBaseline="central">{level}</text>
    </svg>
  );
}

/* One category's score as a ring. score null = not enough data (dashed ring, shows progress to 5). */
export function SkillRing({ score, n, min }: { score: number | null; n: number; min: number }) {
  const value = score ?? Math.round((n / min) * 100);
  return (
    <svg className={'skill-ring' + (score === null ? ' pending' : '')} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="27" className="ring-track" />
      <circle cx="32" cy="32" r="27" className="ring-fill" pathLength={100}
        strokeDasharray={`${Math.max(value, 0.01)} 100`} transform="rotate(-90 32 32)" />
      <text x="32" y="32" className="skill-num" textAnchor="middle" dominantBaseline="central">
        {score === null ? '–' : score}
      </text>
    </svg>
  );
}

function Glyph({ name }: { name: string }) {
  const st = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'play': return <path d="M21 17.5v13l10.5-6.5z" fill="currentColor" />;
    case 'check': return <path d="M17 24.5l4.5 4.5 9.5-10" {...st} />;
    case 'star': return <path d="M24 15.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z" fill="currentColor" />;
    case 'stack': return <g {...st}><path d="M16 20l8-4 8 4-8 4z" /><path d="M16 24.5l8 4 8-4" /><path d="M16 29l8 4 8-4" /></g>;
    case 'dots': return <g fill="currentColor">{[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={16 + i * 4} cy={24} r={1.8} />)}</g>;
    case 'tray': return <g {...st}><path d="M15 25.5h5l1.5 3h5l1.5-3h5" /><path d="M15 25.5l3-8h12l3 8v6H15z" /></g>;
    case 'loop': return <g {...st}><path d="M31 21a7.5 7.5 0 1 0 1 6" /><path d="M31.5 15.5v5.5H26" /></g>;
    case 'target': return <g {...st}><circle cx="24" cy="24" r="8" /><circle cx="24" cy="24" r="3.5" /></g>;
    case 'web': return <path d="M24 15l8 6-3 9.5h-10L16 21z" {...st} />;
    case 'sun': return <g {...st}><circle cx="24" cy="24" r="4" /><path d="M24 15.5v2.5M24 30v2.5M15.5 24H18M30 24h2.5M18 18l1.8 1.8M28.2 28.2L30 30M30 18l-1.8 1.8M19.8 28.2L18 30" /></g>;
    case 'moon': return <path d="M29.5 27.5A8 8 0 0 1 20.5 17a8 8 0 1 0 9 10.5z" fill="currentColor" />;
    case 'snow': return <SnowPaths />;
    case 'cycle': return (
      <g transform="translate(14.4 14.4) scale(0.8)" {...st} strokeWidth={2.8}>
        <path d="M19.5 9A8 8 0 0 0 5.2 7.4" /><path d="M4.5 3.8v3.9h3.9" />
        <path d="M4.5 15a8 8 0 0 0 14.3 1.6" /><path d="M19.5 20.2v-3.9h-3.9" />
      </g>
    );
    case 'bolt': return <path d="M26 14.5l-8 11h6l-1.5 8 8-11h-6z" {...st} />;
    case '?': return <text x="24" y="24.5" textAnchor="middle" dominantBaseline="central" className="medal-num">?</text>;
    default: return <text x="24" y="24.5" textAnchor="middle" dominantBaseline="central" className="medal-num">{name}</text>;
  }
}

function SnowPaths() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M24 15v18M16.2 19.5l15.6 9M16.2 28.5l15.6-9" />
      <path d="M21.5 16.5L24 19l2.5-2.5M21.5 31.5L24 29l2.5 2.5" />
    </g>
  );
}

export function SnowIcon() {
  return <svg viewBox="12 12 24 24" className="snow-icon" aria-hidden="true"><SnowPaths /></svg>;
}

/* Metal tiers: rim (outer), face (inner) and glyph colours */
const TIERS = {
  bronze:   { rim: ['#d99a62', '#8c4f22'], face: ['#f1c193', '#b9763f'], glyph: '#5a2e0e' },
  silver:   { rim: ['#e3e7ec', '#8a939e'], face: ['#f7f9fb', '#b9c1ca'], glyph: '#3c444e' },
  gold:     { rim: ['#f6d76b', '#b07d12'], face: ['#fff1b8', '#e0ad2c'], glyph: '#5c3d02' },
  platinum: { rim: ['#cfe3ee', '#6c8ea3'], face: ['#f2fbff', '#a9cbe0'], glyph: '#22465c' },
  special:  { rim: ['#3a3f48', '#15181d'], face: ['#2a2f37', '#121417'], glyph: '#f2763a' }
} as const;
export type Tier = keyof typeof TIERS;

const HEX = 'M24 3l18.2 10.5v21L24 45 5.8 34.5v-21z';
const HEX_IN = 'M24 8.2l13.7 7.9v15.8L24 39.8l-13.7-7.9V16.1z';

/* Hexagon medal: a two-tone metal finish with a shine when earned, flat grey when not. */
export function Medal({ glyph, earned, hidden, tier = 'bronze', size = 56 }:
  { glyph: string; earned: boolean; hidden?: boolean; tier?: Tier; size?: number }) {
  const t = TIERS[tier];
  const id = `m-${tier}`;
  if (!earned) {
    return (
      <svg viewBox="0 0 48 48" width={size} height={size} className="medal locked" aria-hidden="true">
        <path d={HEX} className="medal-rim" />
        <path d={HEX_IN} className="medal-face" />
        <g className="medal-glyph"><Glyph name={hidden ? '?' : glyph} /></g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={`medal earned tier-${tier}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={t.rim[0]} /><stop offset="1" stopColor={t.rim[1]} />
        </linearGradient>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor={t.face[0]} /><stop offset="1" stopColor={t.face[1]} />
        </linearGradient>
      </defs>
      <path d={HEX} fill={`url(#${id}-rim)`} />
      <path d={HEX_IN} fill={`url(#${id}-face)`} />
      {/* shine across the top-left of the face */}
      <path d="M24 8.2l13.7 7.9v4.2C30 17 20 17.5 10.3 22V16.1z" fill="#fff" opacity={tier === 'special' ? 0.06 : 0.28} />
      <g style={{ color: t.glyph }}><Glyph name={glyph} /></g>
    </svg>
  );
}
