const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
};

export function TickIcon() {
  return <svg viewBox="0 0 20 20" strokeWidth={2.2} {...stroke}><path d="M4.5 10.5l3.5 3.5 7.5-8" /></svg>;
}

export function CrossIcon() {
  return <svg viewBox="0 0 20 20" strokeWidth={2.2} {...stroke}><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" /></svg>;
}

export function ArrowIcon() {
  return <svg viewBox="0 0 20 20" strokeWidth={2} {...stroke}><path d="M4 10h11M11 5.5l4.5 4.5-4.5 4.5" /></svg>;
}

/* 10 squares, echoing the app icon */
export function DailyIcon() {
  const cells = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 5; c++) {
      const i = r * 5 + c;
      cells.push(
        <rect key={i} x={1 + c * 6} y={6 + r * 6} width={4.6} height={4.6} rx={1}
          fill="currentColor" opacity={i < 7 ? 1 : 0.3} />
      );
    }
  }
  return <svg viewBox="0 0 30 24" aria-hidden="true">{cells}</svg>;
}

/* Two arrows chasing each other: go again */
export function PracticeIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2} {...stroke}>
      <path d="M19.5 9A8 8 0 0 0 5.2 7.4" />
      <path d="M4.5 3.8v3.9h3.9" />
      <path d="M4.5 15a8 8 0 0 0 14.3 1.6" />
      <path d="M19.5 20.2v-3.9h-3.9" />
    </svg>
  );
}

/* Lightning bolt: Acronym Blitz */
export function BlitzIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2} {...stroke}>
      <path d="M13.5 2.5L5 13.5h6.5l-1 8 8.5-11h-6.5z" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" strokeWidth={2} {...stroke}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  );
}

export function ClockIcon() {
  return (
    <svg viewBox="0 0 20 20" strokeWidth={1.8} {...stroke}>
      <circle cx="10" cy="10" r="7.25" />
      <path d="M10 6.2V10l2.6 1.6" />
    </svg>
  );
}
