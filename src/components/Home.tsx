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
  /** Acronym Blitz: best score, false if the acronym bank couldn't load, and whether today's full-XP rounds are used */
  blitz: { best: number; available: boolean; done: boolean };
  onBlitz: () => void;
  /** Spot the Phish: best score, false if the card bank couldn't load, and whether today's full-XP rounds are used */
  phish: { best: number; available: boolean; done: boolean };
  onPhish: () => void;
  /** Incident Commander: best grade so far, false if the scenarios couldn't load, and whether today's full-XP rounds are used */
  incident: { best: string | null; available: boolean; done: boolean };
  onIncident: () => void;
}

/* Home tagline: one short line, picked at random once per app open (kept short so it fits one line on a phone). */
const LINES = {
  all: [ // Today's 10, Smart Practice and every game's full-XP rounds are done
    'That’s everything for today.',
    'All done. Go touch grass.',
    'Everything ticked off. Nice.',
    'Full house. See you tomorrow.',
    'Nothing left. Well defended.'
  ],
  done: [
    'Today’s set is done.',
    'Done for today. Nice work.',
    'That’s today sorted.',
    'All ten done. Go stretch.',
    'Set complete. Hackers, beware.',
    'Done. Your firewall is proud.',
    'Today’s ten: handled.',
    'Job done. See you tomorrow.'
  ],
  started: [
    'Pick up where you left off.',
    'Welcome back. Let’s finish it.',
    'Halfway there. Keep going.',
    'Your set is waiting for you.',
    'Back for more? Good call.'
  ],
  fresh: [
    'Your daily cyber workout is ready.',
    'Ten questions. Let’s go.',
    'Fresh set, fresh brain.',
    'Today’s ten are ready.',
    'Welcome back. Coffee first?',
    'Ready when you are.',
    'New day, new questions.'
  ]
};
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];
const TAGLINE = { all: pick(LINES.all), done: pick(LINES.done), started: pick(LINES.started), fresh: pick(LINES.fresh) };

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
      done: true,
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

  /* ---------- Smart Practice ---------- */
  const practice: TileSpec = learned > 0
    ? {
        id: 'practice',
        title: 'Smart Practice',
        icon: <PracticeIcon />,
        meta: due > 0 ? `${due} to review` : `All caught up · ${learned} learned`,
        tone: 'plain',
        done: due === 0,
        onOpen: onPractice,
        foot: <span className="tile-cta">Play</span>
      }
    : {
        id: 'practice',
        title: 'Smart Practice',
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
        done: blitz.done,
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
        done: phish.done,
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
        done: incident.done,
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
  const tiles: TileSpec[] = [daily, practice, profile, blitzTile, phishTile, incidentTile];
  // everything that can be finished today is finished (locked or unavailable tiles don't count against you)
  const allDone = done && tiles.every((t) => t.done || t.wide || t.tone === 'locked');

  return (
    <>
      <p className="home-intro">
        {allDone ? TAGLINE.all : done ? TAGLINE.done : started ? TAGLINE.started : TAGLINE.fresh}
      </p>
      <div className={'tile-grid' + (done ? ' pill-space' : '')}>
        {tiles.map((t) => <Tile key={t.id} {...t} />)}
      </div>

    </>
  );
}
