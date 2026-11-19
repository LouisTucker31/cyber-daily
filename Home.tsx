import type { Day } from './quiz.ts';
import Tile, { type TileSpec } from './Tile.tsx';
import Ticks from './Ticks.tsx';
import { ClockIcon, DailyIcon, LockIcon, PracticeIcon } from './icons.tsx';

interface Props {
  day: Day;
  learned: number;
  countdown: string;
  onDaily: () => void;
  onPractice: () => void;
}

export default function Home({ day, learned, countdown, onDaily, onPractice }: Props) {
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
        meta: `${learned} learned so far`,
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

  /* Add new modes here: each entry becomes a tile in the grid. */
  const tiles: TileSpec[] = [daily, practice];

  return (
    <>
      <p className="home-intro">
        {done
          ? 'Today’s set is done. Keep sharp in Practice.'
          : started ? 'Pick up where you left off.' : 'Your daily cyber workout is ready.'}
      </p>
      <div className="tile-grid">
        {tiles.map((t) => <Tile key={t.id} {...t} />)}
      </div>

      {done && (
        <div className="next-pill" role="status">
          <ClockIcon />
          <span>Next set</span>
          <strong>{countdown}</strong>
        </div>
      )}
    </>
  );
}
