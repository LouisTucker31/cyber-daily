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
}

/* End-of-set summary, used by both the daily quiz and Practice. */
export default function DoneView({ mode, items, byId, countdown, strength }: Props) {
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
    title = right === total ? 'Still sharp.' : 'Practice done.';
    tail = wrong === 0 ? 'Nothing needs resetting.' : `${wrong} reset and will come back tomorrow.`;
  }

  return (
    <>
      <h2 className="done-title">{title}</h2>
      <p className="done-sub"><b>{right} of {total}</b> correct. {tail}</p>
      <Ticks items={items} current={-1} compact />

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
