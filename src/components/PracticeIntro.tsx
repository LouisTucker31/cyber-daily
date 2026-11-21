import { INTERVALS, PRACTICE_COUNT, PRACTICE_DAILY_CAP } from '../lib/quiz.ts';
import { XP } from '../lib/progress.ts';
import { BlitzIcon, DailyIcon, PracticeIcon, TickIcon } from './icons.tsx';

interface Props {
  dueToday: number;   // left in today's target
  waiting: number;    // due beyond today's target (comes back tomorrow, or now if you keep going)
  doneToday: number;  // due reviews answered today
  learned: number;    // everything in Smart Practice
  boxes: number[];    // items per box, box 1 first
}

function days(n: number): string {
  return n === 1 ? '1 day' : `${n} days`;
}

/* Shown before a Smart Practice round: what it is, today's numbers and how the boxes work. */
export default function PracticeIntro({ dueToday, waiting, doneToday, learned, boxes }: Props) {
  const rounds = Math.ceil(dueToday / PRACTICE_COUNT);
  const rules = [
    { tone: 'combo', icon: <PracticeIcon />, value: String(dueToday), label: dueToday === 1 ? 'review left today' : 'reviews left today' },
    { tone: 'clock', icon: <DailyIcon />, value: String(PRACTICE_COUNT), label: 'questions a round' },
    { tone: 'good', icon: <TickIcon />, value: `+${XP.practiceDue} XP`, label: 'for each due review you get right' },
    { tone: 'combo', icon: <BlitzIcon />, value: `+${XP.practiceRound} XP`, label: 'for finishing a round with reviews in it' }
  ];
  const most = Math.max(1, ...boxes);

  let status: string;
  if (dueToday > 0) {
    status = `That’s about ${rounds} ${rounds === 1 ? 'round' : 'rounds'}.`;
  } else if (waiting > 0) {
    status = `Today’s ${PRACTICE_DAILY_CAP} are done. ${waiting} more ${waiting === 1 ? 'is' : 'are'} waiting if you want to keep going.`;
  } else {
    status = 'You’re all caught up. Extra rounds still help, at 1 XP a question.';
  }

  return (
    <div className="blitz-intro practice-intro">
      <h2 className="done-title">Revise what you know.</h2>
      <p className="done-sub">
        Smart Practice brings back questions you’ve got right, and acronyms you’ve missed in Blitz, just before you’d forget them. {status}
      </p>

      <div className="rule-grid">
        {rules.map((r, i) => (
          <div key={i} className={'rule rule-' + r.tone}>
            <span className="rule-icon">{r.icon}</span>
            <span className="rule-value">{r.value}</span>
            <span className="rule-label">{r.label}</span>
          </div>
        ))}
      </div>

      <p className="section-label">How it works</p>
      <p className="p-explain">
        Everything sits in one of five boxes. Get it right and it moves up a box, so it comes back less often.
        Get it wrong and it drops back to box 1, so you’ll see it tomorrow.
      </p>
      <ul className="box-chart" aria-label="Your items in each box">
        {boxes.map((n, i) => (
          <li key={i}>
            <span className="box-count">{n}</span>
            <span className="box-bar">{n > 0 && <i style={{ height: `${Math.max(6, Math.round((n / most) * 100))}%` }} />}</span>
            <span className="box-name">Box {i + 1}</span>
            <span className="box-gap">{days(INTERVALS[i])}</span>
          </li>
        ))}
      </ul>
      <p className="p-explain">
        Up to {PRACTICE_DAILY_CAP} reviews a day, most overdue first. Anything over waits until tomorrow, so nothing is lost.
        Questions you haven’t got right yet stay in Today’s 10 until you do.
      </p>

      <p className="blitz-foot">
        <span>In Smart Practice <b>{learned}</b></span>
        <span>Reviewed today <b>{doneToday}</b></span>
      </p>
    </div>
  );
}
