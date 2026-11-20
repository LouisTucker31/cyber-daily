import type { Day } from '../lib/quiz.ts';
import Tile, { type TileSpec } from './Tile.tsx';
import Ticks from './Ticks.tsx';
import { BlitzIcon, DailyIcon, IncidentIcon, LockIcon, PhishIcon, PracticeIcon } from './icons.tsx';
import { LevelRing } from './Badge.tsx';

interface Props {
  day: Day;
  learned: number;
  due: number;
  onDaily: () => void;
  onPractice: () => void;
  onProfile: () => void;
  level: { level: number; rank: string; progress: number; toNext: number; next: { name: string } | null };
  /** Acronym Blitz: best score, and false if the acronym bank couldn't load */
  blitz: { best: number; available: boolean };
  onBlitz: () => void;
  /** Spot the Phish: best score, and false if the card bank couldn't load */
  phish: { best: number; available: boolean };
  onPhish: () => void;
  /** Incident Commander: best grade so far, and false if the scenarios couldn't load */
  incident: { best: string | null; available: boolean };
  onIncident: () => void;
}

export default function Home({ day, learned, due, onDaily, onPractice, onProfile, level, blitz, onBlitz, phish, onPhish, incident, onIncident }: Props) {
  const total = day.items.length;
  const answered = day.items.filter((it) => it.chosen !== null).length;
  const right = day.items.filter((it) => it.correct === true).length;
  const done = total > 0 && day.index >= total;
  const started = answered > 0 || day.index > 0;

  /* ---------- Today's 10 (always the orange tile) ---------- */
  let daily: TileSpec;
  if (done) {
    daily = {
      id: 'daily',
      title: 'Today’s 10',
      icon: <DailyIcon />,
      meta: `Done · ${right} of ${total} correct`,
      tone: 'feature-done',
      onOpen: onDaily, // opens today's results (read only)
      foot: <span className="tile-link">See results</span>
    };
  } else {
    daily = {
      id: 'daily',
      title: 'Today’s 10',
      icon: <DailyIcon />,
      meta: total === 0 ? 'No questions available'
        : started ? `${answered} of ${total} answered` : `${total} new questions`,
      tone: 'feature',
      onOpen: total > 0 ? onDaily : undefined,
      foot: started
        ? <><Ticks items={day.items} current={day.index} plain /><span className="tile-cta">Continue</span></>
        : <span className="tile-cta">Start</span>
    };
  }

  /* ---------- Practice ---------- */
  const practice: TileSpec = learned > 0
    ? {
        id: 'practice',
        title: 'Practice',
        icon: <PracticeIcon />,
        meta: due > 0 ? `${due} due for review` : `All caught up · ${learned} learned`,
        badge: due,
        tone: 'plain',
        onOpen: onPractice,
        foot: <span className="tile-cta">Play</span>
      }
    : {
        id: 'practice',
        title: 'Practice',
        icon: <LockIcon />,
        meta: 'Unlocks when you get a daily question right',
        tone: 'locked'
      };

  /* ---------- Acronym Blitz (from level 1) ---------- */
  const blitzTile: TileSpec = blitz.available
    ? {
        id: 'blitz',
        title: 'Acronym Blitz',
        icon: <BlitzIcon />,
        meta: blitz.best > 0 ? `Best ${blitz.best}` : '60-second speed round',
        tone: 'plain',
        onOpen: onBlitz,
        foot: <span className="tile-cta">Play</span>
      }
    : {
        id: 'blitz',
        title: 'Acronym Blitz',
        icon: <BlitzIcon />,
        meta: 'Go online once to download it',
        tone: 'locked'
      };

  /* ---------- Spot the Phish (from level 1; harder levels unlock inside) ---------- */
  const phishTile: TileSpec = phish.available
    ? {
        id: 'phish',
        title: 'Spot the Phish',
        icon: <PhishIcon />,
        meta: phish.best > 0 ? `Best ${phish.best}` : 'Phish or legit? 10 cards',
        tone: 'plain',
        onOpen: onPhish,
        foot: <span className="tile-cta">Play</span>
      }
    : {
        id: 'phish',
        title: 'Spot the Phish',
        icon: <PhishIcon />,
        meta: 'Go online once to download it',
        tone: 'locked'
      };

  /* ---------- Incident Commander ---------- */
  const incidentTile: TileSpec = incident.available
    ? {
        id: 'incident',
        title: 'Incident Commander',
        icon: <IncidentIcon />,
        meta: incident.best ? `Best grade ${incident.best}` : 'Lead the response to a cyber attack',
        tone: 'plain',
        onOpen: onIncident,
        foot: <span className="tile-cta">Play</span>
      }
    : {
        id: 'incident',
        title: 'Incident Commander',
        icon: <IncidentIcon />,
        meta: 'Go online once to download it',
        tone: 'locked'
      };

  /* ---------- Profile (full width) ---------- */
  const profile: TileSpec = {
    id: 'profile',
    title: `Level ${level.level} · ${level.rank}`,
    icon: <LevelRing level={level.level} progress={level.progress} size={48} />,
    meta: level.next ? `${level.toNext.toLocaleString('en-GB')} XP to ${level.next.name}` : 'Top rank reached',
    tone: 'plain',
    wide: true,
    onOpen: onProfile,
    foot: <span className="xp-bar" aria-hidden="true"><i style={{ width: `${Math.round(level.progress * 100)}%` }} /></span>
  };

  /* Add new modes here: each entry becomes a tile in the grid. */
  // the primary pair (Today's 10, Practice), the Profile, then the games as square tiles
  const tiles: TileSpec[] = [daily, practice, profile, incidentTile, blitzTile, phishTile];

  return (
    <>
      <p className="home-intro">
        {done
          ? (due > 0 ? `Today’s set is done. ${due} ${due === 1 ? 'question is' : 'questions are'} due in Practice.` : 'Today’s set is done. Keep sharp in Practice.')
          : started ? 'Pick up where you left off.' : 'Your daily cyber workout is ready.'}
      </p>
      <div className={'tile-grid' + (done ? ' pill-space' : '')}>
        {tiles.map((t) => <Tile key={t.id} {...t} />)}
      </div>

    </>
  );
}
