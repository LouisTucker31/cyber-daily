import { useEffect, type ReactNode } from 'react';
import type { Celebration as C, State } from '../lib/quiz.ts';
import { BADGES, categoryScore, levelInfo, MAX_FREEZES, skillTier } from '../lib/progress.ts';
import { LevelRing, Medal } from './Badge.tsx';
import { haptic } from '../lib/haptics.ts';
import Sheet from './Sheet.tsx';
import LevelUp from './LevelUp.tsx';
import Award from './Award.tsx';

interface Props {
  item: C;
  state: State;
  onDone: () => void;
  onProfile: () => void;
}

const TIER_NAME = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', special: 'Secret' } as const;

/* Level-ups get the full-screen LevelUp, badges and skill-ups the smaller Award,
   and streak-freeze news a bottom sheet. */
export default function Celebration({ item, state, onDone, onProfile }: Props) {
  const own = item.kind === 'level' || item.kind === 'badge' || item.kind === 'skill';
  useEffect(() => { if (!own) haptic('success'); }, [item, own]); // the full-screen ones play their own

  if (item.kind === 'level') {
    const n = item.n ?? 1;
    const lv = levelInfo(state.xp);
    return <LevelUp level={n} progress={lv.level === n ? lv.progress : 1} onDone={onDone} />;
  }
  if (item.kind === 'badge') {
    const b = BADGES.find((x) => x.id === item.id);
    if (b) {
      return (
        <Award art={<Medal glyph={b.glyph} earned tier={b.tier} size={132} />}
          kicker={`Badge earned · ${TIER_NAME[b.tier]}`} title={b.name} body={b.desc} onDone={onDone} />
      );
    }
  }
  if (item.kind === 'skill' && item.id) {
    const { score } = categoryScore(state, item.id);
    const t = skillTier(score);
    if (t) {
      return (
        <Award art={<Medal glyph={String(score)} earned tier={t.tier} size={132} />}
          kicker={`Skill up · ${TIER_NAME[t.tier]}`} title={item.id}
          body={`You’re now ${t.label.toLowerCase()} here, scoring ${score} out of 100. Keep it up.`} onDone={onDone} />
      );
    }
  }

  let art: ReactNode;
  let kicker: string;
  let title: string;
  let body: string;

  if (item.kind === 'freeze-earned') {
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
    <Sheet onClose={onDone} labelledBy="sheet-title">
      {(close) => (
        <>
          <div className="sheet-art"><span className="pop">{art}</span></div>
          <p className="sheet-kicker">{kicker}</p>
          <h2 className="sheet-title" id="sheet-title">{title}</h2>
          <p className="sheet-body">{body}</p>
          <button type="button" className="btn" onClick={() => close()}>Nice</button>
          <button type="button" className="sheet-link" onClick={() => close(onProfile)}>View profile</button>
        </>
      )}
    </Sheet>
  );
}
