import { useEffect, useState } from 'react';
import { dateKey, type Day, type Question } from './quiz.ts';
import Ticks from './Ticks.tsx';
import { CrossIcon, TickIcon } from './icons.tsx';

interface Props {
  day: Day;
  byId: Map<string, Question>;
  onNewDay: () => void;
}

function timeToMidnight(): string {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const s = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function DoneView({ day, byId, onNewDay }: Props) {
  const [remaining, setRemaining] = useState(timeToMidnight);

  useEffect(() => {
    const t = setInterval(() => {
      if (dateKey() !== day.date) onNewDay();
      else setRemaining(timeToMidnight());
    }, 1000);
    return () => clearInterval(t);
  }, [day.date, onNewDay]);

  const total = day.items.length;
  const right = day.items.filter((it) => it.correct === true).length;
  const wrong = total - right;

  return (
    <>
      <h2 className="done-title">{right === total ? 'Clean sweep.' : 'That’s today done.'}</h2>
      <p className="done-sub">
        <b>{right} of {total}</b> correct.{' '}
        {wrong === 0
          ? 'Nothing goes back in the pot.'
          : `${wrong} ${wrong === 1 ? 'goes' : 'go'} back in the pot for another day.`}
      </p>
      <Ticks items={day.items} current={-1} compact />

      <p className="section-label">Today’s questions</p>
      <ul className="recap">
        {day.items.map((it) => (
          <li key={it.id} className={it.correct ? 'right' : 'wrong'}>
            <span>{it.correct ? <TickIcon /> : <CrossIcon />}</span>
            <span>{byId.get(it.id)?.question}</span>
          </li>
        ))}
      </ul>

      <div className="next-set">
        <span>Next set unlocks in</span>
        <strong>{remaining}</strong>
      </div>
    </>
  );
}
