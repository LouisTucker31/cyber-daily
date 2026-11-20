import { useEffect, type ReactNode } from 'react';
import type { Celebration as C, State } from './quiz.ts';
import { BADGES, levelInfo, MAX_FREEZES, RANKS } from './progress.ts';
import { LevelRing, Medal } from './Badge.tsx';
import { haptic } from './haptics.ts';

interface Props {
  item: C;
  state: State;
  onDone: () => void;
  onProfile: () => void;
}

/* Bottom sheet for level-ups, new badges and streak-freeze news. */
export default function Celebration({ item, state, onDone, onProfile }: Props) {
  useEffect(() => { haptic('success'); }, [item]);

  let art: ReactNode;
  let kicker: string;
  let title: string;
  let body: string;

  if (item.kind === 'level') {
    const rank = RANKS[(item.n ?? 1) - 1];
    art = <LevelRing level={rank.level} progress={1} size={96} />;
    kicker = 'Level up';
    title = rank.name;
    body = `You’ve reached level ${rank.level}. Keep going to unlock more.`;
  } else if (item.kind === 'badge') {
    const b = BADGES.find((x) => x.id === item.id)!;
    art = <Medal glyph={b.glyph} earned tier={b.tier} size={96} />;
    kicker = 'Badge earned';
    title = b.name;
    body = b.desc;
  } else if (item.kind === 'freeze-earned') {
    art = <Medal glyph="snow" earned tier="platinum" size={96} />;
    kicker = 'Streak freeze earned';
    title = `${item.n} of ${MAX_FREEZES}`;
    body = 'Seven days in a row. If you miss a day, a freeze is used automatically to protect your streak.';
  } else if (item.kind === 'freeze-used') {
    art = <Medal glyph="snow" earned tier="platinum" size={96} />;
    kicker = 'Streak saved';
    title = `${state.streak.count}-day streak kept`;
    body = item.n === 1
      ? 'You missed a day, so a streak freeze kept your streak alive.'
      : `You missed ${item.n} days, so ${item.n} streak freezes kept your streak alive.`;
  } else {
    const lv = levelInfo(state.xp);
    const badges = Object.keys(state.badges).length;
    art = <LevelRing level={lv.level} progress={lv.progress} size={96} />;
    kicker = 'New: your Profile';
    title = `Level ${lv.level} · ${lv.rank}`;
    body = `Your progress so far has been counted${badges ? `, with ${badges} ${badges === 1 ? 'badge' : 'badges'} earned` : ''}. ` +
      'Tap the ring at the top right any time to see your strengths, weaknesses and badges.';
  }

  return (
    <div className="sheet-backdrop" onClick={onDone}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-art"><span className="pop">{art}</span></div>
        <p className="sheet-kicker">{kicker}</p>
        <h2 className="sheet-title" id="sheet-title">{title}</h2>
        <p className="sheet-body">{body}</p>
        <button type="button" className="btn" onClick={onDone}>Nice</button>
        <button type="button" className="sheet-link" onClick={() => { onDone(); onProfile(); }}>View profile</button>
      </div>
    </div>
  );
}
