/* Level ring and badge medals, drawn in SVG so they stay crisp and themeable. */

export function LevelRing({ level, progress, size = 44 }: { level: number; progress: number; size?: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <svg className="level-ring" viewBox="0 0 48 48" width={size} height={size} aria-label={`Level ${level}`}>
      <circle cx="24" cy="24" r={r} className="ring-track" />
      <circle cx="24" cy="24" r={r} className="ring-fill"
        strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 24 24)" />
      <text x="24" y="24" className="ring-num" textAnchor="middle" dominantBaseline="central">{level}</text>
    </svg>
  );
}

function Glyph({ name }: { name: string }) {
  const st = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'play': return <path d="M21 17.5v13l10.5-6.5z" fill="currentColor" />;
    case 'check': return <path d="M17 24.5l4.5 4.5 9.5-10" {...st} />;
    case 'star': return <path d="M24 15.5l2.6 5.6 6 .7-4.5 4.1 1.2 6-5.3-3-5.3 3 1.2-6-4.5-4.1 6-.7z" fill="currentColor" />;
    case 'stack': return <g {...st}><path d="M16 20l8-4 8 4-8 4z" /><path d="M16 24.5l8 4 8-4" /><path d="M16 29l8 4 8-4" /></g>;
    case 'dots': return <g fill="currentColor">{[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={16 + i * 4} cy={24} r={1.7} />)}</g>;
    case 'tray': return <g {...st}><path d="M15 25.5h5l1.5 3h5l1.5-3h5" /><path d="M15 25.5l3-8h12l3 8v6H15z" /></g>;
    case 'loop': return <g {...st}><path d="M31 21a7.5 7.5 0 1 0 1 6" /><path d="M31.5 15.5v5.5H26" /></g>;
    case 'target': return <g {...st}><circle cx="24" cy="24" r="8" /><circle cx="24" cy="24" r="3.5" /></g>;
    case 'web': return <path d="M24 15l8 6-3 9.5h-10L16 21z" {...st} />;
    case 'sun': return <g {...st}><circle cx="24" cy="24" r="4" /><path d="M24 15.5v2.5M24 30v2.5M15.5 24H18M30 24h2.5M18 18l1.8 1.8M28.2 28.2L30 30M30 18l-1.8 1.8M19.8 28.2L18 30" /></g>;
    case 'moon': return <path d="M29.5 27.5A8 8 0 0 1 20.5 17a8 8 0 1 0 9 10.5z" fill="currentColor" />;
    case 'snow': return <SnowPaths />;
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

/* Hexagon medal: filled orange when earned, outline when not. */
export function Medal({ glyph, earned, hidden, size = 56 }: { glyph: string; earned: boolean; hidden?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={'medal' + (earned ? ' earned' : '')} aria-hidden="true">
      <path className="medal-hex" d="M24 3.5l17.5 10v21L24 44.5l-17.5-10v-21z" />
      <Glyph name={!earned && hidden ? '?' : glyph} />
    </svg>
  );
}
