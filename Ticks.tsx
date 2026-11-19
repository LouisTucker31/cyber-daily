interface TickItem {
  id: string;
  correct: boolean | null;
}

interface Props {
  items: TickItem[];
  current: number;
  compact?: boolean;
  /** progress only (no right/wrong colours), for use on coloured tiles */
  plain?: boolean;
}

export default function Ticks({ items, current, compact, plain }: Props) {
  return (
    <div
      className={'ticks' + (compact ? ' compact' : '') + (plain ? ' plain' : '')}
      style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, 1fr)` }}
      aria-hidden="true"
    >
      {items.map((it, i) => {
        let cls = 'tick';
        if (plain && it.correct !== null) cls += ' done';
        else if (it.correct === true) cls += ' right';
        else if (it.correct === false) cls += ' wrong';
        else if (i === current) cls += ' current';
        return <span key={it.id} className={cls} />;
      })}
    </div>
  );
}
