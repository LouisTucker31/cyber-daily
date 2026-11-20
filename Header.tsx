import { LevelRing, SnowIcon } from './Badge.tsx';

interface Props {
  streak: number;
  freezes: number;
  level: number;
  levelProgress: number;
  /** Home only: tapping the streak/level opens the Profile */
  onProfile?: () => void;
  /** When set, shows a round back button and the screen's title instead of the app name. */
  nav?: { label: string; onHome: () => void };
}

export default function Header({ streak, freezes, level, levelProgress, onProfile, nav }: Props) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <header className="topbar">
      {nav ? (
        <div className="nav">
          <button type="button" className="back-btn" onClick={nav.onHome} aria-label="Back to Home">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4.5L6.5 10l5.5 5.5" />
            </svg>
          </button>
          <h1 className="screen-title">{nav.label}</h1>
        </div>
      ) : (
        <div>
          <h1 className="wordmark">Cyber Daily <span>10</span></h1>
          <div className="today">{today}</div>
        </div>
      )}
      {(() => {
        const inner = (
          <>
            <span className={'streak' + (streak > 0 ? ' live' : '')}>
              <span className="streak-label">
                Streak
                {freezes > 0 && <span className="freeze-count" aria-label={`${freezes} streak freezes`}><SnowIcon />{freezes}</span>}
              </span>
              <span className="streak-value">{streak}<small>{streak === 1 ? 'day' : 'days'}</small></span>
            </span>
            <LevelRing level={level} progress={levelProgress} />
          </>
        );
        return onProfile
          ? <button type="button" className="me" onClick={onProfile} aria-label={`Level ${level}, ${streak} day streak. Open profile`}>{inner}</button>
          : <div className="me">{inner}</div>;
      })()}
    </header>
  );
}
