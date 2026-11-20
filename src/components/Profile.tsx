import { useState, type ReactNode } from 'react';
import { dueIds, learnedIds, practiceIds, type Question, type State } from '../lib/quiz.ts';
import {
  BADGES, badgeContext, levelInfo, MIN_ANSWERS, profileRows, RANKS, shortName, SKILL_INFO, skillTier
} from '../lib/progress.ts';
import type { Acronym } from '../lib/blitz.ts';
import { LevelRing, Medal, SnowIcon } from './Badge.tsx';
import { BlitzIcon, ChevronIcon, ChevronRightIcon, DailyIcon, IncidentIcon, PhishIcon, PracticeIcon } from './icons.tsx';
import { CATEGORY as PHISH_CATEGORY } from '../lib/phish.ts';
import { haptic } from '../lib/haptics.ts';
import Sheet from './Sheet.tsx';

const TIER_NAME = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', platinum: 'Platinum', special: 'Secret' } as const;
const FIRST_ROW = 3; // tiles shown before "Show all"
const INCIDENT_SKILLS = ['Security Monitoring and Incident Response', 'Resilience and Security Management', 'Malware and Attacks', 'Data Protection and Privacy'];

interface Props {
  state: State;
  bank: Question[];
  practiceBank: Question[];
  acronyms: Acronym[];
  streak: number;
  onDaily: () => void;
}

/* A grid of tiles: the first row shows, the rest fold away behind "Show all" */
/* A section whose title row has the count and a small arrow that shows or hides the rest */
function FoldGrid({ title, summary, count, open, onToggle, children }:
  { title: string; summary: string; count: number; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <>
      <h2 className="p-title">
        <span>{title}</span>
        {count > FIRST_ROW ? (
          <button type="button" className="p-fold" onClick={() => { haptic(); onToggle(); }} aria-expanded={open}
            aria-label={`${summary}. ${open ? 'Show fewer' : `Show all ${count}`}`}>
            <span className="p-count">{summary}</span><Chevron open={open} />
          </button>
        ) : <span className="p-count">{summary}</span>}
      </h2>
      <div className="badges">{children}</div>
    </>
  );
}

const tileClass = (i: number, open: boolean, earned: boolean) =>
  'badge' + (earned ? ' earned' : '') + (i >= FIRST_ROW ? ' extra' : '') + (i >= FIRST_ROW && !open ? ' folded' : '');
const tileStyle = (i: number) => (i >= FIRST_ROW ? { animationDelay: `${(i - FIRST_ROW) * 25}ms` } : undefined);

const Chevron = ChevronIcon;

export default function Profile({ state, bank, practiceBank, acronyms, streak, onDaily }: Props) {
  const lv = levelInfo(state.xp);
  const rows = profileRows(state, bank);
  const ctx = badgeContext(state, bank);
  const learned = learnedIds(state, bank).length;
  const dayLeft = !!state.day && state.day.items.length > 0 && state.day.index < state.day.items.length;

  const [spin, setSpin] = useState(0);
  const [showRanks, setShowRanks] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [showAllSkills, setShowAllSkills] = useState(false);
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

  /* skills: highest score first, then unscored ones closest to getting a score */
  const skills = rows.map((r, i) => ({ r, i })).sort((x, y) =>
    (y.r.score ?? -1) - (x.r.score ?? -1) || y.r.n - x.r.n || x.i - y.i).map((x) => x.r);
  // strongest and weakest (only once there's enough to compare)
  const scored = skills.filter((r) => r.score !== null);
  /* the next milestone across all skills: every one scored, then silver, gold, platinum */
  const MILESTONES: [string, (s: number | null) => boolean][] = [
    ['scored', (s) => s !== null], ['silver or better', (s) => (s ?? 0) >= 50],
    ['gold or better', (s) => (s ?? 0) >= 75], ['platinum', (s) => (s ?? 0) >= 90]
  ];
  const goal = MILESTONES.find(([, ok]) => rows.filter((r) => ok(r.score)).length < rows.length) ?? MILESTONES[3];
  const skillGoal = `${rows.filter((r) => goal[1](r.score)).length} of ${rows.length} ${goal[0]}`;
  const top = scored.length >= 3 ? scored[0].name : null;
  const focus = scored.length >= 3 ? scored[scored.length - 1].name : null;
  const selected = rows.find((r) => r.name === skill) ?? null;

  /* what feeds each skill, for its detail sheet */
  const skillWays = (name: string) => {
    const qs = bank.filter((q) => (q.category || 'General') === name);
    const learnedSet = new Set(state.learned);
    const inCat = new Set(practiceBank.filter((q) => q.category === name).map((q) => q.id));
    const review = practiceIds(state, practiceBank).filter((id) => inCat.has(id));
    const due = dueIds(state, practiceBank).filter((id) => inCat.has(id));
    const acr = acronyms.filter((a) => a.category === name);
    const acrRight = acr.filter((a) => state.blitz.rightAt[a.id] !== undefined).length;
    return [
      { icon: <DailyIcon />, name: 'Today’s 10', meta: `${qs.filter((q) => learnedSet.has(q.id)).length} of ${qs.length} questions learned` },
      { icon: <PracticeIcon />, name: 'Smart Practice',
        meta: review.length ? `${due.length ? `${due.length} due now` : 'Nothing due'} · ${review.length} in review`
          : 'Get one right to add it here' },
      ...(acr.length ? [{ icon: <BlitzIcon />, name: 'Acronym Blitz', meta: `${acr.length} acronyms · ${acrRight} got right` }] : []),
      ...(name === PHISH_CATEGORY ? [{ icon: <PhishIcon />, name: 'Spot the Phish',
        meta: state.phish.rounds ? `${state.phish.caught} phish caught · best ${state.phish.best}` : 'Phish or legit? 10 cards a round' }] : []),
      ...(INCIDENT_SKILLS.includes(name) ? [{ icon: <IncidentIcon />, name: 'Incident Commander',
        meta: state.incident.rounds ? `${state.incident.rounds} played · best grade ${Object.values(state.incident.best).sort()[0]}` : 'Lead the response to a live attack' }] : [])
    ];
  };

  return (
    <div className="profile">
      {dayLeft && (
        <button type="button" className="nudge" onClick={onDaily}>
          <span className="nudge-dot" aria-hidden="true" />
          Today’s 10 is waiting
          <ChevronRightIcon />
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
          <div className="xp-now">
            <span className="xp-now-value">{state.xp.toLocaleString('en-GB')} XP</span>
            <span className="xp-now-label">
              {lv.next ? `of ${lv.next.xp.toLocaleString('en-GB')} for level ${lv.next.level}` : 'Every rank unlocked'}
            </span>
          </div>
          <ol className="ranks">
            {RANKS.map((r) => (
              <li key={r.level} className={r.level === lv.level ? 'current' : r.level < lv.level ? 'past' : ''}>
                <span className="ranks-lvl">{r.level}</span>
                <span className="ranks-name">{r.name}</span>
                <span className="ranks-xp">{r.xp.toLocaleString('en-GB')} XP</span>
              </li>
            ))}
          </ol>
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

      {/* skills: one medal per category, coloured by score; tap for details */}
      <section className="p-section">
        <FoldGrid title="Skills" summary={skillGoal} count={skills.length} open={showAllSkills} onToggle={() => setShowAllSkills((v) => !v)}>
          {skills.map((r, i) => {
            const t = skillTier(r.score);
            return (
              <button
                key={r.name}
                type="button"
                className={tileClass(i, showAllSkills, !!t)}
                style={tileStyle(i)}
                onClick={() => { haptic(); setSkill(r.name); }}
                aria-haspopup="dialog"
                aria-label={`${r.name}: ${r.score === null ? 'not scored yet' : `${r.score} out of 100`}`}
              >
                <Medal glyph={r.score === null ? '–' : String(r.score)} earned={!!t} tier={t?.tier} />
                <span className="badge-name">{shortName(r.name)}</span>
              </button>
            );
          })}
        </FoldGrid>
      </section>

      {/* badges: first row, the rest folded away */}
      <section className="p-section">
        <FoldGrid title="Badges" summary={`${earnedCount} of ${BADGES.length}`} count={badges.length} open={showAllBadges}
          onToggle={() => setShowAllBadges((v) => !v)}>
          {badges.map(({ b, earnedAt }, i) => (
            <button
              key={b.id}
              type="button"
              className={tileClass(i, showAllBadges, !!earnedAt)}
              style={tileStyle(i)}
              onClick={() => { haptic(); setOpenBadge(b.id); }}
              aria-haspopup="dialog"
            >
              <Medal glyph={b.glyph} earned={!!earnedAt} hidden={b.hidden} tier={b.tier} />
              <span className="badge-name">{!earnedAt && b.hidden ? 'Hidden' : b.name}</span>
            </button>
          ))}
        </FoldGrid>
      </section>

      {/* skill details slide up from the bottom */}
      {selected && (
        <Sheet key={selected.name} onClose={() => setSkill(null)} labelledBy="skill-title">
          {() => {
            const r = selected;
            const t = skillTier(r.score);
            const note = r.name === top ? ' · Your strongest' : r.name === focus ? ' · Your focus' : '';
            const trend = r.trend !== null && Math.abs(r.trend) >= 5
              ? ` · ${r.trend > 0 ? 'up' : 'down'} ${Math.abs(r.trend)} in 2 weeks` : '';
            const prog: [number, number] = r.score === null ? [r.n, MIN_ANSWERS] : [r.score, 100];
            return (
              <>
                <div className="sheet-art"><span className={t ? 'pop' : ''}>
                  <Medal glyph={r.score === null ? '–' : String(r.score)} earned={!!t} tier={t?.tier} size={80} />
                </span></div>
                <p className="sheet-kicker">{t ? `${TIER_NAME[t.tier]} · ${t.label}` : 'Not scored yet'}{note}</p>
                <h2 className="sheet-title" id="skill-title">{r.name}</h2>
                <p className="sheet-body">{SKILL_INFO[r.name] ?? 'Questions from this topic.'}</p>
                <div className="sheet-prog">
                  <span className="xp-bar" aria-hidden="true"><i style={{ width: `${Math.round((prog[0] / prog[1]) * 100)}%` }} /></span>
                  <span>{r.score === null ? `${r.n} of ${MIN_ANSWERS} answers` : `${r.score} of 100`}</span>
                </div>
                <p className="sheet-small">
                  {r.score === null
                    ? `Answer ${MIN_ANSWERS - r.n} more to get a score.`
                    : `From your last ${r.n} answers, recent ones count most${trend}.`}
                </p>
                <h3 className="ways-title">Where to build it</h3>
                <ul className="ways">
                  {skillWays(r.name).map((w) => (
                    <li key={w.name}>
                      <span className="ways-icon">{w.icon}</span>
                      <span className="ways-text"><b>{w.name}</b><span>{w.meta}</span></span>
                    </li>
                  ))}
                </ul>
              </>
            );
          }}
        </Sheet>
      )}

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
