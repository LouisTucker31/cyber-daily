import { useState } from 'react';
import type { Question, State } from '../lib/quiz.ts';
import { BADGES, badgeContext, levelInfo, MIN_ANSWERS, profileRows, RANKS, shortName, XP } from '../lib/progress.ts';
import { learnedIds } from '../lib/quiz.ts';
import { LevelRing, Medal, SkillRing, SnowIcon } from './Badge.tsx';
import { haptic } from '../lib/haptics.ts';
import Sheet from './Sheet.tsx';

const TIER_NAME = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', special: 'Secret' } as const;

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

  /* badges: earned (newest first), then closest to completion, then not started */
  const badges = BADGES.map((b, i) => {
    const earnedAt = state.badges[b.id] ?? null;
    const prog = !earnedAt && b.progress ? b.progress(ctx) : null;
    return { b, i, earnedAt, prog, ratio: prog ? prog[0] / prog[1] : 0 };
  }).sort((x, y) => {
    if (x.earnedAt && y.earnedAt) return y.earnedAt.localeCompare(x.earnedAt) || x.i - y.i;
    if (x.earnedAt) return -1;
    if (y.earnedAt) return 1;
    return y.ratio - x.ratio || x.i - y.i;
  });
  const earnedCount = BADGES.filter((b) => state.badges[b.id]).length;
  const shown = badges.find((x) => x.b.id === openBadge) ?? null;

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
            sweep, {XP.practiceDue} per due review right. Acronym Blitz: {XP.blitzCorrect} per answer right
            and {XP.blitzRound} per round, for your first {XP.blitzRoundsPerDay} rounds each day.
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
          {badges.map(({ b, earnedAt }, i) => {
            const extra = i >= 3;
            return (
              <button
                key={b.id}
                type="button"
                className={'badge' + (earnedAt ? ' earned' : '') + (extra ? ' extra' : '') +
                  (extra && !showAllBadges ? ' folded' : '')}
                style={extra ? { animationDelay: `${(i - 3) * 25}ms` } : undefined}
                onClick={() => { haptic(); setOpenBadge(b.id); }}
                aria-haspopup="dialog"
              >
                <Medal glyph={b.glyph} earned={!!earnedAt} hidden={b.hidden} tier={b.tier} />
                <span className="badge-name">{!earnedAt && b.hidden ? 'Hidden' : b.name}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className="more" onClick={() => setShowAllBadges((v) => !v)} aria-expanded={showAllBadges}>
          {showAllBadges ? 'Show less' : `Show all ${BADGES.length}`}<Chevron open={showAllBadges} />
        </button>
      </section>

      {/* badge details slide up from the bottom */}
      {shown && (
        <Sheet key={shown.b.id} onClose={() => setOpenBadge(null)} labelledBy="badge-title">
          {() => {
            const { b, earnedAt, prog } = shown;
            const secret = !earnedAt && b.hidden;
            const status = earnedAt
              ? `Earned ${new Date(earnedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : prog && prog[0] > 0 ? 'In progress' : 'Not started yet';
            return (
              <>
                <div className="sheet-art"><span className={earnedAt ? 'pop' : ''}>
                  <Medal glyph={b.glyph} earned={!!earnedAt} hidden={b.hidden} tier={b.tier} size={96} />
                </span></div>
                <p className="sheet-kicker">{TIER_NAME[b.tier]} · {status}</p>
                <h2 className="sheet-title" id="badge-title">{secret ? 'Hidden badge' : b.name}</h2>
                <p className="sheet-body">{secret ? 'Keep playing to discover this one.' : b.desc}</p>
                {prog && (
                  <div className="sheet-prog">
                    <span className="xp-bar" aria-hidden="true"><i style={{ width: `${Math.round((prog[0] / prog[1]) * 100)}%` }} /></span>
                    <span>{prog[0]} of {prog[1]}</span>
                  </div>
                )}
              </>
            );
          }}
        </Sheet>
      )}
    </div>
  );
}
