import type { ReactNode } from 'react';
import { TickIcon } from './icons.tsx';

export interface TileSpec {
  id: string;
  title: string;
  icon: ReactNode;
  /** One short line under the title, e.g. "10 questions ready" */
  meta: string;
  /** Optional extra content at the bottom of the tile (progress, countdown, call to action) */
  foot?: ReactNode;
  /** 'feature' = orange highlight, 'feature-done' = soft orange (finished), 'plain' = white, 'locked' = greyed out */
  tone: 'feature' | 'feature-done' | 'plain' | 'locked';
  /** Leave out to make the tile non-tappable */
  onOpen?: () => void;
  /** Small count bubble in the corner (e.g. questions due), hidden when 0 */
  badge?: number;
  /** Spread across both columns */
  wide?: boolean;
  /** Today's part of this mode is finished: a small tick in the corner, and a quieter call to action */
  done?: boolean;
}

export default function Tile({ title, icon, meta, foot, tone, onOpen, wide, badge, done }: TileSpec) {
  const cls = `tile tile-${tone}` + (wide ? ' tile-wide' : '') + (done ? ' tile-done' : '');
  const inner = (
    <>
      <span className="tile-icon">{icon}</span>
      {done && <span className="tile-done-mark" aria-label="Done for today"><TickIcon /></span>}
      {!!badge && badge > 0 && <span className="tile-badge" aria-label={`${badge} due`}>{badge > 99 ? '99+' : badge}</span>}
      <span className="tile-body">
        <span className="tile-title">{title}</span>
        <span className="tile-meta">{meta}</span>
      </span>
      {foot && <span className="tile-foot">{foot}</span>}
    </>
  );
  return onOpen
    ? <button type="button" className={cls} onClick={onOpen}>{inner}</button>
    : <div className={cls} aria-disabled="true">{inner}</div>;
}
