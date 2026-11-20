import { useState } from 'react';
import type { Question, State } from '../lib/quiz.ts';
import { BADGES, badgeContext, levelInfo, MIN_ANSWERS, profileRows, RANKS, shortName, XP } from '../lib/progress.ts';
import { learnedIds } from '../lib/quiz.ts';
import { LevelRing, Medal, SkillRing, SnowIcon } from './Badge.tsx';
import { haptic } from '../lib/haptics.ts';

interface Props {
  state: State;
  bank: Question[];
  streak: number;
  onDaily: () => void;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg className={'chev' + (open ? ' open' : '')} viewBox="0 0 20 20" fill="none" stroke="currentColor"
      strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.5 8l4.5 4.5L14.5 8" />
    </svg>
  );
}

export default function Profile({ state, bank, streak, onDaily }: Props) {
  const lv = levelInfo(state.xp);
  const rows = profileRows(state, bank);
  const ctx = badgeContext(state, bank);
  const learned = learnedIds(state, bank).length;
  const dayLeft = !!state.day && state.day.items.length > 0 && state.day.index < state.day.items.length;

  const [spin, setSpin] = useState(0);
  const [showRanks, setShowRanks] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [openBadge, setOpenBadge] = useState<string | null>(null);
  const [skill, setSkill] = useState<string | null>(null);

  // badges: earned first (newest first), then the rest in their set order
  const badges = [...BADGES].sort((a, b) => {
    const ea = state.badges[a.id], eb = state.badges[b.id];
    if (ea && eb) return eb.localeCompare(ea);
    if (ea) return -1;
    if (eb) return 1;
    return 0;
  });
  const earnedCount = BADGES.filter((b) => state.badges[b.id]).length;

  // strongest and weakest (only once there's enough to compare)
  const scored = rows.filter((r) => r.score !== null).sort((a, b) => b.score! - a.score!);
  const top = scored.length >= 3 ? scored[0].name : null;
  const focus = scored.length >= 3 ? scored[scored.length - 1].name : null;
  const selected = rows.find((r) => r.name === skill) ?? null;

  return (
    <div className="profile">
      {dayLeft && (
        <button type="button" className="nudge" onClick={onDaily}>
          <span className="nudge-dot" aria-hidden="true" />
          Today’s 10 is waiting
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true"><path d="M8 4.5l5.5 5.5L8 15.5" /></svg>
        </button>
      )}

      {/* rank: tap the coin to spin it, tap the name to see all ranks */}
      <section className="rank">
        <button
          type="button"
          className="coin"
          aria-label={`Level ${lv.level}`}
          onClick={() => { haptic(); setSpin((n) => n + 1); }}
        >
          <span key={spin} className={spin ? 'coin-face spinning' : 'coin-face'}>
            <LevelRing level={lv.level} progress={lv.progress} size={88} />
          </span>
        </button>
        <button type="button" className="rank-text" onClick={() => setShowRanks((v) => !v)} aria-expanded={showRanks}>
          <span className="rank-level">Level {lv.level}</span>
          <span className="rank-name">{lv.rank}<Chevron open={showRanks} /></span>
          <span className="xp-bar" aria-hidden="true"><i style={{ width: `${Math.round(lv.progress * 100)}%` }} /></span>
          <span className="rank-next">
            {lv.next ? `${lv.toNext.toLocaleString('en-GB')} XP to ${lv.next.name}` : 'Top rank reached'}
          </span>
        </button>
      </section>

      <div className={'collapse' + (showRanks ? ' open' : '')}>
        <div className="collapse-inner">
          <ol className="ranks">
            {RANKS.map((r) => (
              <li key={r.level} className={r.level === lv.level ? 'current' : r.level < lv.level ? 'past' : ''}>
                <span className="ranks-lvl">{r.level}</span>
                <span className="ranks-name">{r.name}</span>
                <span className="ranks-xp">{r.xp.toLocaleString('en-GB')} XP</span>
              </li>
            ))}
          </ol>
          <p className="p-note">
            {XP.dailyCorrect} XP per daily question right, {XP.dailyComplete} for finishing, {XP.cleanSweep} for a clean
            sweep, {XP.practiceDue} per due review right.
          </p>
        </div>
      </div>

      {/* key stats: the streak box frosts over when a freeze is protecting it */}
      <section className="stat-row">
        <div className={'stat' + (state.freezes > 0 ? ' frozen' : '')}>
          {state.freezes > 0 && (
            <span className="frost-tag"><SnowIcon />{state.freezes > 1 ? `×${state.freezes}` : ''}</span>
          )}
          <span className="stat-value">{streak}</span>
          <span className="stat-label">Day streak</span>
        </div>
        <div className="stat">
          <span className="stat-value">{learned}</span>
          <span className="stat-label">Learned</span>
        </div>
        <div className="stat">
          <span className="stat-value">{state.xp.toLocaleString('en-GB')}</span>
          <span className="stat-label">Total XP</span>
        </div>
      </section>

      {/* skills: one ring per category */}
      <section className="p-section">
        <h2 className="p-title">Skills</h2>
        <div className="skills">
          {rows.map((r) => (
            <button
              key={r.name}
              type="button"
              className={'skill' + (skill === r.name ? ' on' : '') + (r.name === focus ? ' focus' : '') + (r.name === top ? ' top' : '')}
              onClick={() => setSkill(skill === r.name ? null : r.name)}
              aria-label={`${r.name}: ${r.score === null ? 'not enough data' : r.score}`}
            >
              <SkillRing score={r.score} n={r.n} min={MIN_ANSWERS} />
              <span className="skill-name">{shortName(r.name)}</span>
            </button>
          ))}
        </div>
        <p className="skill-caption">
          {selected
            ? (selected.score === null
              ? <><b>{selected.name}</b> · {selected.n} of {MIN_ANSWERS} answers needed for a score</>
              : <><b>{selected.name}</b> · {selected.score}/100 from your last {selected.n} answers
                {selected.trend !== null && Math.abs(selected.trend) >= 5 && <> · {selected.trend > 0 ? 'up' : 'down'} {Math.abs(selected.trend)} in 2 weeks</>}</>)
            : (top && focus
              ? <>Strongest <b>{shortName(top)}</b> · focus on <b>{shortName(focus)}</b>. Tap a ring for details.</>
              : 'Tap a ring for details. Recent answers count most.')}
        </p>
      </section>

      {/* badges: first row, the rest folded away */}
      <section className="p-section">
        <h2 className="p-title">Badges <span className="p-count">{earnedCount} of {BADGES.length}</span></h2>
        <div className="badges">
          {badges.map((b, i) => {
            const earned = !!state.badges[b.id];
            const secret = !earned && b.hidden;
            const prog = !earned && b.progress ? b.progress(ctx) : null;
            const open = openBadge === b.id;
            const extra = i >= 3;
            return (
              <button
                key={b.id}
                type="button"
                className={'badge' + (earned ? ' earned' : '') + (open ? ' open' : '') + (extra ? ' extra' : '') +
                  (extra && !showAllBadges ? ' folded' : '')}
                style={extra ? { animationDelay: `${(i - 3) * 25}ms` } : undefined}
                onClick={() => setOpenBadge(open ? null : b.id)}
                aria-expanded={open}
              >
                <Medal glyph={b.glyph} earned={earned} hidden={b.hidden} tier={b.tier} />
                <span className="badge-text">
                  <span className="badge-name">{secret ? 'Hidden' : b.name}</span>
                  {open && <span className="badge-desc">{secret ? 'Keep playing to discover this one.' : b.desc}</span>}
                  {prog && <span className="badge-prog">{prog[0]}/{prog[1]}</span>}
                  {earned && open && (
                    <span className="badge-prog">
                      Earned {new Date(state.badges[b.id]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" className="more" onClick={() => setShowAllBadges((v) => !v)} aria-expanded={showAllBadges}>
          {showAllBadges ? 'Show less' : `Show all ${BADGES.length}`}<Chevron open={showAllBadges} />
        </button>
      </section>
    </div>
  );
}
