import { useEffect, useState } from 'react';
import { LevelRing, SnowIcon } from './Badge.tsx';
import { BackIcon } from './icons.tsx';

/* The header ring fills in once when the app opens, not on every page change. */
let headerRingPlayed = false;

function HeaderRing({ level, progress }: { level: number; progress: number }) {
  const [animate] = useState(() => !headerRingPlayed);
  useEffect(() => { headerRingPlayed = true; }, []);
  return <LevelRing level={level} progress={progress} animate={animate} />;
}

interface Props {
  /** True once saved progress has loaded, so the opening animation shows the real level */
  ready: boolean;
  streak: number;
  freezes: number;
  level: number;
  levelProgress: number;
  /** Home only: tapping the streak/level opens the Profile */
  onProfile?: () => void;
  /** When set, shows a round back button and the screen's title instead of the app name. */
  nav?: { label: string; onHome: () => void };
}

export default function Header({ ready, streak, freezes, level, levelProgress, onProfile, nav }: Props) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <header className="topbar">
      {nav ? (
        <div className="nav">
          <button type="button" className="back-btn" onClick={nav.onHome} aria-label="Back to Home">
            <BackIcon />
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
            {ready
              ? <HeaderRing level={level} progress={levelProgress} />
              : <LevelRing level={level} progress={levelProgress} animate={false} />}
          </>
        );
        return onProfile
          ? <button type="button" className="me" onClick={onProfile} aria-label={`Level ${level}, ${streak} day streak. Open profile`}>{inner}</button>
          : <div className="me">{inner}</div>;
      })()}
    </header>
  );
}
