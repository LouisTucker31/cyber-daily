import { useState } from 'react';
import type { Question, State } from './quiz.ts';
import {
  BADGES, badgeContext, levelInfo, MAX_FREEZES, MIN_ANSWERS, profileRows, RANKS, recommendations
} from './progress.ts';
import { learnedIds } from './quiz.ts';
import { LevelRing, Medal, SnowIcon } from './Badge.tsx';
import { ArrowIcon } from './icons.tsx';

interface Props {
  state: State;
  bank: Question[];
  streak: number;
  onDaily: () => void;
  onPractice: () => void;
}

function Trend({ value }: { value: number | null }) {
  if (value === null || Math.abs(value) < 5) return null;
  const up = value > 0;
  return (
    <span className={'trend ' + (up ? 'up' : 'down')} aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(value)} in two weeks`}>
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d={up ? 'M6 2.5l4 5H2z' : 'M6 9.5l4-5H2z'} fill="currentColor" /></svg>
      {Math.abs(value)}
    </span>
  );
}

export default function Profile({ state, bank, streak, onDaily, onPractice }: Props) {
  const lv = levelInfo(state.xp);
  const rows = profileRows(state, bank);
  const scored = rows.filter((r) => r.score !== null).sort((a, b) => b.score! - a.score!);
  const unscored = rows.filter((r) => r.score === null);
  const recs = recommendations(state, bank);
  const ctx = badgeContext(state, bank);
  const earnedCount = BADGES.filter((b) => state.badges[b.id]).length;
  const [openBadge, setOpenBadge] = useState<string | null>(null);

  const strongest = scored.slice(0, 2);
  const weakest = scored.length > 2 ? scored.slice(-2).reverse() : [];

  return (
    <div className="profile">
      {/* rank */}
      <section className="rank">
        <LevelRing level={lv.level} progress={lv.progress} size={88} />
        <div className="rank-text">
          <span className="rank-level">Level {lv.level}</span>
          <span className="rank-name">{lv.rank}</span>
          <span className="xp-bar" aria-hidden="true"><i style={{ width: `${Math.round(lv.progress * 100)}%` }} /></span>
          <span className="rank-next">
            {lv.next ? `${lv.toNext.toLocaleString('en-GB')} XP to ${lv.next.name}` : 'Top rank reached'}
          </span>
        </div>
      </section>

      {/* key stats */}
      <section className="stat-row">
        <div className="stat">
          <span className="stat-value">{streak}</span>
          <span className="stat-label">Day streak</span>
          <span className="stat-sub">Best {state.streak.best ?? streak}</span>
        </div>
        <div className="stat">
          <span className="stat-value stat-freeze"><SnowIcon />{state.freezes}</span>
          <span className="stat-label">Freezes</span>
          <span className="stat-sub">of {MAX_FREEZES} max</span>
        </div>
        <div className="stat">
          <span className="stat-value">{learnedIds(state, bank).length}</span>
          <span className="stat-label">Learned</span>
          <span className="stat-sub">{state.xp.toLocaleString('en-GB')} XP</span>
        </div>
      </section>

      {/* recommendations */}
      {recs.length > 0 && (
        <section className="p-section">
          <h2 className="p-title">Recommended next</h2>
          <ul className="recs">
            {recs.map((r, i) => (
              <li key={i}>
                <span>{r.text}</span>
                {r.action && (
                  <button type="button" className="chip" onClick={r.action === 'daily' ? onDaily : onPractice}>
                    {r.label}<ArrowIcon />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* strengths & weaknesses */}
      <section className="p-section">
        <h2 className="p-title">Strengths and weaknesses</h2>
        {scored.length === 0 ? (
          <p className="p-note">
            Answer at least {MIN_ANSWERS} questions in a category to get a score. Scores weight your most recent answers.
          </p>
        ) : (
          <>
            <p className="p-summary">
              Strongest: <b>{strongest.map((r) => r.name).join(', ')}</b>.
              {weakest.length > 0 && <> Focus on: <b>{weakest.map((r) => r.name).join(', ')}</b>.</>}
            </p>
            <ul className="scores">
              {scored.map((r) => (
                <li key={r.name}>
                  <div className="score-head">
                    <span className="score-name">{r.name}</span>
                    <span className="score-val"><Trend value={r.trend} />{r.score}</span>
                  </div>
                  <span className="score-bar"><i style={{ width: `${r.score}%` }} /></span>
                </li>
              ))}
            </ul>
          </>
        )}
        {unscored.length > 0 && (
          <>
            <p className="p-sub">Not enough data yet</p>
            <ul className="scores muted">
              {unscored.map((r) => (
                <li key={r.name}>
                  <div className="score-head">
                    <span className="score-name">{r.name}</span>
                    <span className="score-val">{r.n}/{MIN_ANSWERS}</span>
                  </div>
                  <span className="score-bar"><i style={{ width: `${(r.n / MIN_ANSWERS) * 100}%` }} /></span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* badges */}
      <section className="p-section">
        <h2 className="p-title">Badges <span className="p-count">{earnedCount} of {BADGES.length}</span></h2>
        <div className="badges">
          {BADGES.map((b) => {
            const earned = !!state.badges[b.id];
            const secret = !earned && b.hidden;
            const prog = !earned && b.progress ? b.progress(ctx) : null;
            const open = openBadge === b.id;
            return (
              <button
                key={b.id}
                type="button"
                className={'badge' + (earned ? ' earned' : '') + (open ? ' open' : '')}
                onClick={() => setOpenBadge(open ? null : b.id)}
                aria-expanded={open}
              >
                <Medal glyph={b.glyph} earned={earned} hidden={b.hidden} />
                <span className="badge-name">{secret ? 'Hidden' : b.name}</span>
                {open && <span className="badge-desc">{secret ? 'Keep playing to discover this one.' : b.desc}</span>}
                {!open && prog && <span className="badge-prog">{prog[0]}/{prog[1]}</span>}
                {!open && earned && (
                  <span className="badge-prog">
                    {new Date(state.badges[b.id]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ranks */}
      <section className="p-section">
        <h2 className="p-title">Ranks</h2>
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
          XP: 10 per daily question right, 20 for finishing the set, 50 more for a clean sweep, 5 per due review
          right in Practice.
        </p>
      </section>
    </div>
  );
}
