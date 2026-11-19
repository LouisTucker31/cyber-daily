interface Props {
  streak: number;
  /** When set, shows a back-to-home row with the current mode's name. */
  nav?: { label: string; onHome: () => void };
}

export default function Header({ streak, nav }: Props) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <header className="topbar">
      <div>
        {nav ? (
          <button type="button" className="back" onClick={nav.onHome}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12.5 4.5L7 10l5.5 5.5" />
            </svg>
            Home
          </button>
        ) : (
          <h1 className="wordmark">Cyber Daily <span>10</span></h1>
        )}
        <div className="today">{nav ? nav.label : today}</div>
      </div>
      <div className={'streak' + (streak > 0 ? ' live' : '')}>
        <div className="streak-label">Streak</div>
        <div className="streak-value">
          {streak}<small>{streak === 1 ? 'day' : 'days'}</small>
        </div>
      </div>
    </header>
  );
}
