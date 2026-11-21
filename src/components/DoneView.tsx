import type { Question } from '../lib/quiz.ts';
import Ticks from './Ticks.tsx';
import { CrossIcon, TickIcon } from './icons.tsx';
import { StrengthDots } from './QuestionView.tsx';

interface ResultItem {
  id: string;
  correct: boolean | null;
}

interface Props {
  mode: 'daily' | 'practice';
  items: ResultItem[];
  byId: Map<string, Question>;
  countdown?: string;
  /** Practice: current strength box for each question */
  strength?: (id: string) => number;
  /** Smart Practice: XP the round earned, reviews left in today's target, and any waiting beyond it */
  practice?: { xp: number; left: number; waiting: number };
}

function practiceStatus(left: number, waiting: number): string {
  if (left > 0) return `${left} ${left === 1 ? 'review' : 'reviews'} left today.`;
  if (waiting > 0) return `That’s today’s reviews done. ${waiting} more ${waiting === 1 ? 'is' : 'are'} waiting if you want to keep going.`;
  return 'All caught up for today.';
}

/* End-of-set summary, used by both the daily quiz and Smart Practice. */
export default function DoneView({ mode, items, byId, countdown, strength, practice }: Props) {
  const total = items.length;
  const right = items.filter((it) => it.correct === true).length;
  const wrong = total - right;

  let title: string;
  let tail: string;
  if (mode === 'daily') {
    title = right === total ? 'Clean sweep.' : 'That’s today done.';
    tail = wrong === 0 ? 'Nothing goes back in the pot.'
      : `${wrong} ${wrong === 1 ? 'goes' : 'go'} back in the pot for another day.`;
  } else {
    title = right === total ? 'Still sharp.' : 'Round done.';
    tail = wrong === 0 ? 'Nothing needs resetting.' : `${wrong} reset and will come back tomorrow.`;
  }

  return (
    <>
      <h2 className="done-title">{title}</h2>
      <p className="done-sub"><b>{right} of {total}</b> correct. {tail}</p>
      <Ticks items={items} current={-1} compact />

      {practice && (
        <div className="next-set">
          <span>{practiceStatus(practice.left, practice.waiting)}</span>
          <strong>+{practice.xp} XP</strong>
        </div>
      )}

      <p className="section-label">{mode === 'daily' ? 'Today’s questions' : 'This round'}</p>
      <ul className="recap">
        {items.map((it) => (
          <li key={it.id} className={it.correct ? 'right' : 'wrong'}>
            <span>{it.correct ? <TickIcon /> : <CrossIcon />}</span>
            <span>
              {byId.get(it.id)?.question}
              {strength && <StrengthDots box={strength(it.id)} />}
            </span>
          </li>
        ))}
      </ul>

      {countdown && (
        <div className="next-set">
          <span>Next set unlocks in</span>
          <strong>{countdown}</strong>
        </div>
      )}
    </>
  );
}
