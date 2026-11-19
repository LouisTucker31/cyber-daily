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
  /** Spread across both columns */
  wide?: boolean;
}

export default function Tile({ title, icon, meta, foot, tone, onOpen, wide }: TileSpec) {
  const cls = `tile tile-${tone}` + (wide ? ' tile-wide' : '');
  const inner = (
    <>
      <span className="tile-icon">{icon}</span>
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
