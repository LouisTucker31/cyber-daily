/* Levels, XP, badges, streak freezes and the category scores behind the Profile.
   Everything here works on the saved State and is called from quiz.ts / App.tsx. */
import { dateKey, dayBefore, daysUntil, dueIds, learnedIds, MAX_BOX, type Question, type State } from './quiz.ts';

/* ---------- XP & levels ---------- */

export const XP = {
  dailyCorrect: 10,
  dailyComplete: 20,
  cleanSweep: 50,
  practiceDue: 5,     // a right answer on a question that was due
  practiceEarly: 1    // right, but not due yet (stops grinding)
};

export const RANKS = [
  { level: 1, name: 'Trainee', xp: 0 },
  { level: 2, name: 'Analyst', xp: 250 },
  { level: 3, name: 'Senior Analyst', xp: 800 },
  { level: 4, name: 'Threat Hunter', xp: 1600 },
  { level: 5, name: 'Incident Lead', xp: 2700 },
  { level: 6, name: 'Incident Manager', xp: 4100 },
  { level: 7, name: 'Head of Security', xp: 5800 },
  { level: 8, name: 'Security Director', xp: 7800 },
  { level: 9, name: 'Deputy CISO', xp: 10200 },
  { level: 10, name: 'CISO', xp: 13000 }
];

export function levelFor(xp: number): number {
  let lvl = 1;
  for (const r of RANKS) if (xp >= r.xp) lvl = r.level;
  return lvl;
}

export function levelInfo(xp: number) {
  const level = levelFor(xp);
  const rank = RANKS[level - 1];
  const next = RANKS[level] ?? null;
  const progress = next ? (xp - rank.xp) / (next.xp - rank.xp) : 1;
  return { level, rank: rank.name, next, toNext: next ? next.xp - xp : 0, progress };
}

/* ---------- streak freezes ---------- */

export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;

/* Called when a new day starts: missed days are covered by freezes if you have enough. */
export function applyFreezes(state: State): void {
  const last = state.streak.last;
  if (!last || state.streak.count === 0) return;
  const missed = -daysUntil(last) - 1; // whole days with no completed set, not counting today
  if (missed <= 0) return;
  if (missed <= state.freezes) {
    state.freezes -= missed;
    state.stats.freezesUsed += missed;
    state.streak.last = dayBefore(dateKey()); // streak carries on as if yesterday was done
    state.celebrations.push({ kind: 'freeze-used', n: missed });
  }
}

/* Called when a day's set is finished (after the streak count is updated). */
export function onDayComplete(state: State): void {
  const day = state.day;
  if (!day) return;
  const s = state.stats;
  s.daysCompleted += 1;
  state.xp += XP.dailyComplete;
  if (day.items.length > 0 && day.items.every((it) => it.correct)) {
    s.cleanSweeps += 1;
    state.xp += XP.cleanSweep;
    if (day.items.every((it) => !it.hint)) s.cleanNoHints += 1;
  }
  const hour = new Date().getHours();
  if (hour < 7) s.earlyBird += 1;
  if (hour >= 23) s.nightOwl += 1;
  state.streak.best = Math.max(state.streak.best ?? 0, state.streak.count);
  if (state.streak.count > 0 && state.streak.count % FREEZE_EVERY === 0 && state.freezes < MAX_FREEZES) {
    state.freezes += 1;
    state.celebrations.push({ kind: 'freeze-earned', n: state.freezes });
  }
}

/* ---------- category scores (Profile) ---------- */

export const MIN_ANSWERS = 5; // below this a category shows "not enough data"
const RECENT = 30;
const DECAY = 0.93;            // recent answers count more

export function categoryScore(state: State, category: string, until?: string): { score: number; n: number } {
  let num = 0, den = 0, n = 0;
  for (let i = state.log.length - 1; i >= 0 && n < RECENT; i--) {
    const e = state.log[i];
    if (e.c !== category || (until && e.d > until)) continue;
    const w = Math.pow(DECAY, n);
    num += w * (e.ok ? 1 : 0);
    den += w;
    n++;
  }
  return { score: den ? Math.round((num / den) * 100) : 0, n };
}

export function categories(bank: Question[]): string[] {
  return [...new Set(bank.map((q) => q.category || 'General'))];
}

export interface CategoryRow {
  name: string;
  score: number | null; // null = not enough data
  n: number;
  trend: number | null; // change vs 14 days ago
}

export function profileRows(state: State, bank: Question[]): CategoryRow[] {
  const twoWeeksAgo = (() => {
    const d = new Date(); d.setDate(d.getDate() - 14); return dateKey(d);
  })();
  return categories(bank).map((name) => {
    const now = categoryScore(state, name);
    const then = categoryScore(state, name, twoWeeksAgo);
    const score = now.n >= MIN_ANSWERS ? now.score : null;
    const trend = score !== null && then.n >= MIN_ANSWERS ? now.score - then.score : null;
    return { name, score, n: now.n, trend };
  });
}

/* ---------- badges ---------- */

export interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  glyph: string;          // which icon to draw (see icons in Badge.tsx)
  hidden?: boolean;       // shows as ??? until earned
  progress?: (c: Ctx) => [number, number];
  earned: (c: Ctx) => boolean;
}

interface Ctx {
  state: State;
  learned: number;
  rows: CategoryRow[];
}

const count = (n: number, target: number): [number, number] => [Math.min(n, target), target];

export const BADGES: BadgeDef[] = [
  { id: 'first-shift', name: 'First Shift', desc: 'Finish your first Today’s 10.', glyph: 'play',
    earned: (c) => c.state.stats.daysCompleted >= 1 },
  { id: 'clean-sweep', name: 'Clean Sweep', desc: 'Get all 10 right in a day.', glyph: 'check',
    earned: (c) => c.state.stats.cleanSweeps >= 1 },
  { id: 'no-help', name: 'No Help Needed', desc: 'A clean sweep without using a hint.', glyph: 'star',
    earned: (c) => c.state.stats.cleanNoHints >= 1 },
  { id: 'streak-3', name: 'On a Roll', desc: 'A 3-day streak.', glyph: '3',
    progress: (c) => count(c.state.streak.best ?? 0, 3), earned: (c) => (c.state.streak.best ?? 0) >= 3 },
  { id: 'streak-7', name: 'Week on Watch', desc: 'A 7-day streak.', glyph: '7',
    progress: (c) => count(c.state.streak.best ?? 0, 7), earned: (c) => (c.state.streak.best ?? 0) >= 7 },
  { id: 'streak-30', name: 'Month on Duty', desc: 'A 30-day streak.', glyph: '30',
    progress: (c) => count(c.state.streak.best ?? 0, 30), earned: (c) => (c.state.streak.best ?? 0) >= 30 },
  { id: 'streak-100', name: 'Centurion', desc: 'A 100-day streak.', glyph: '100',
    progress: (c) => count(c.state.streak.best ?? 0, 100), earned: (c) => (c.state.streak.best ?? 0) >= 100 },
  { id: 'bank-25', name: 'Building the Bank', desc: 'Learn 25 questions.', glyph: 'stack',
    progress: (c) => count(c.learned, 25), earned: (c) => c.learned >= 25 },
  { id: 'bank-50', name: 'Well Read', desc: 'Learn 50 questions.', glyph: 'stack',
    progress: (c) => count(c.learned, 50), earned: (c) => c.learned >= 50 },
  { id: 'bank-100', name: 'Encyclopaedic', desc: 'Learn 100 questions.', glyph: 'stack',
    progress: (c) => count(c.learned, 100), earned: (c) => c.learned >= 100 },
  { id: 'locked-in', name: 'Locked In', desc: 'Get a question to full strength in Practice.', glyph: 'dots',
    earned: (c) => Object.values(c.state.srs).some((e) => e.box >= MAX_BOX) },
  { id: 'inbox-zero', name: 'Inbox Zero', desc: 'Clear every review that’s due in a day (at least 5).', glyph: 'tray',
    earned: (c) => c.state.stats.reviewsCleared >= 1 },
  { id: 'second-chance', name: 'Second Chance', desc: 'Get a daily question right that you’d got wrong before.', glyph: 'loop',
    earned: (c) => c.state.stats.secondChance >= 1 },
  { id: 'specialist', name: 'Specialist', desc: 'Score 90+ in any category (from 10+ answers).', glyph: 'target',
    earned: (c) => c.rows.some((r) => r.score !== null && r.score >= 90 && r.n >= 10) },
  { id: 'all-rounder', name: 'All-Rounder', desc: 'Score 70+ in every category (from 10+ answers each).', glyph: 'web',
    progress: (c) => count(c.rows.filter((r) => r.score !== null && r.score >= 70 && r.n >= 10).length, c.rows.length),
    earned: (c) => c.rows.length > 0 && c.rows.every((r) => r.score !== null && r.score >= 70 && r.n >= 10) },
  { id: 'early-bird', name: 'Early Bird', desc: 'Finish Today’s 10 before 7am.', glyph: 'sun', hidden: true,
    earned: (c) => c.state.stats.earlyBird >= 1 },
  { id: 'night-owl', name: 'Night Owl', desc: 'Finish Today’s 10 after 11pm.', glyph: 'moon', hidden: true,
    earned: (c) => c.state.stats.nightOwl >= 1 },
  { id: 'saved', name: 'Saved by the Freeze', desc: 'A streak freeze kept your streak alive.', glyph: 'snow', hidden: true,
    earned: (c) => c.state.stats.freezesUsed >= 1 }
];

/* ---------- evaluate after every change ---------- */

export function evaluateProgress(state: State, bank: Question[], silent = false): void {
  const today = dateKey();

  // Inbox Zero: everything due is cleared, with at least 5 reviews answered today
  const reviewedToday = state.log.filter((e) => e.m === 'practice' && e.d === today).length;
  if (reviewedToday >= 5 && state.stats.lastCleared !== today && dueIds(state, bank).length === 0) {
    state.stats.reviewsCleared += 1;
    state.stats.lastCleared = today;
  }

  // level ups
  const level = levelFor(state.xp);
  if (level > state.levelSeen) {
    if (!silent) state.celebrations.push({ kind: 'level', n: level });
    state.levelSeen = level;
  }

  // badges
  const ctx: Ctx = { state, learned: learnedIds(state, bank).length, rows: profileRows(state, bank) };
  for (const b of BADGES) {
    if (!state.badges[b.id] && b.earned(ctx)) {
      state.badges[b.id] = today;
      if (!silent) state.celebrations.push({ kind: 'badge', id: b.id });
    }
  }
}

export function badgeContext(state: State, bank: Question[]): Ctx {
  return { state, learned: learnedIds(state, bank).length, rows: profileRows(state, bank) };
}

/* ---------- recommendations ---------- */

export interface Recommendation {
  text: string;
  action?: 'daily' | 'practice';
  label?: string;
}

export function recommendations(state: State, bank: Question[]): Recommendation[] {
  const out: Recommendation[] = [];
  const day = state.day;
  const due = dueIds(state, bank).length;
  const rows = profileRows(state, bank);
  const scored = rows.filter((r) => r.score !== null).sort((a, b) => (a.score! - b.score!));

  if (day && day.index < day.items.length) {
    out.push({ text: 'Today’s 10 is still waiting.', action: 'daily', label: 'Start' });
  }
  if (due > 0) {
    out.push({ text: `${due} ${due === 1 ? 'question is' : 'questions are'} due for review.`, action: 'practice', label: 'Review' });
  }
  const weakest = scored[0];
  if (weakest && weakest.score! < 80) {
    out.push({
      text: `${weakest.name} is your weakest area (${weakest.score}). Practice leans on it automatically.`,
      action: learnedIds(state, bank).length > 0 ? 'practice' : undefined,
      label: 'Practise'
    });
  }
  const falling = rows.filter((r) => r.trend !== null && r.trend <= -10).sort((a, b) => a.trend! - b.trend!)[0];
  if (falling && falling !== weakest) {
    out.push({ text: `${falling.name} has dropped ${Math.abs(falling.trend!)} points in two weeks.` });
  }
  const unseen = rows.filter((r) => r.n === 0).length;
  if (unseen > 0 && out.length < 3) {
    out.push({ text: `${unseen} ${unseen === 1 ? 'category hasn’t' : 'categories haven’t'} come up yet. They’ll appear in Today’s 10.` });
  }
  if (state.freezes === 0 && out.length < 3) {
    const toGo = FREEZE_EVERY - (state.streak.count % FREEZE_EVERY);
    out.push({ text: `${toGo} more ${toGo === 1 ? 'day' : 'days'} in a row earns a streak freeze.` });
  }
  return out.slice(0, 3);
}
