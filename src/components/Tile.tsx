import type { ReactNode } from 'react';

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
}

export default function Tile({ title, icon, meta, foot, tone, onOpen, wide, badge }: TileSpec) {
  const cls = `tile tile-${tone}` + (wide ? ' tile-wide' : '');
  const inner = (
    <>
      <span className="tile-icon">{icon}</span>
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
