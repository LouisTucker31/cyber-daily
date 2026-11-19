import type { DayItem } from './quiz.ts';

interface Props {
  items: DayItem[];
  current: number;
  compact?: boolean;
}

export default function Ticks({ items, current, compact }: Props) {
  return (
    <div className={'ticks' + (compact ? ' compact' : '')} aria-hidden="true">
      {items.map((it, i) => {
        let cls = 'tick';
        if (it.correct === true) cls += ' right';
        else if (it.correct === false) cls += ' wrong';
        else if (i === current) cls += ' current';
        return <span key={it.id} className={cls} />;
      })}
    </div>
  );
}
