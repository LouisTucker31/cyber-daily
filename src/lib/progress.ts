/* Levels, XP, badges, streak freezes and the category scores behind the Profile.
   Everything here works on the saved State and is called from quiz.ts / App.tsx. */
import { dateKey, dayBefore, daysUntil, dueIds, learnedIds, MAX_BOX, type Question, type State } from './quiz.ts';

/* ---------- XP & levels ---------- */

export const XP = {
  dailyCorrect: 10,
  dailyComplete: 20,
  cleanSweep: 50,
  practiceDue: 5,     // a right answer on a question that was due
  practiceEarly: 1,   // right, but not due yet (stops grinding)
  blitzCorrect: 2,    // per right answer in a finished Acronym Blitz round
  blitzRound: 10,     // for finishing a Blitz round
  phishCorrect: 2,    // per right call in Spot the Phish (+1 at Analyst, +2 at Expert)
  phishRound: 10      // for finishing a Spot the Phish round
};

/* Games (Blitz, Spot the Phish) never stop paying XP, but it tapers so levels still mean
   something: full XP for the first rounds each day, then half, then a quarter. */
export const FULL_XP_ROUNDS = 3;
export function gameXpRate(roundsToday: number): number {
  return roundsToday < FULL_XP_ROUNDS ? 1 : roundsToday < 10 ? 0.5 : 0.25;
}
export const xpRateText = (rate: number) => (rate === 1 ? 'full XP' : rate === 0.5 ? 'half XP' : 'quarter XP');

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

/* Short names for the skill rings (falls back to the first word) */
const SHORT: Record<string, string> = {
  'Cybersecurity Fundamentals': 'Basics',
  'Passwords and Authentication': 'Passwords',
  'Phishing and Social Engineering': 'Phishing',
  'Malware and Attacks': 'Malware',
  'Networks and the Web': 'Networks',
  'Devices and Endpoint Security': 'Devices',
  'Data Protection and Privacy': 'Data',
  'Security Monitoring and Incident Response': 'Monitoring',
  'Cloud and Application Security': 'Cloud',
  'Resilience and Security Management': 'Resilience'
};
export const shortName = (c: string) => SHORT[c] ?? c.split(' ')[0];

/* What each skill covers, shown in its detail sheet */
export const SKILL_INFO: Record<string, string> = {
  'Cybersecurity Fundamentals': 'The core ideas everything else builds on: risk, threats, and keeping data confidential, intact and available.',
  'Passwords and Authentication': 'Strong passwords, password managers, multi-factor sign-in and how accounts get taken over.',
  'Phishing and Social Engineering': 'Spotting tricks that target people rather than systems: fake emails, calls, texts and links.',
  'Malware and Attacks': 'Viruses, ransomware, worms and the common ways attackers break in.',
  'Networks and the Web': 'How traffic moves and how it is protected: Wi-Fi, firewalls, VPNs, HTTPS and DNS.',
  'Devices and Endpoint Security': 'Keeping laptops and phones safe: updates, encryption, antivirus and lost devices.',
  'Data Protection and Privacy': 'Handling personal data properly, backups, sharing safely and privacy law.',
  'Security Monitoring and Incident Response': 'Noticing when something is wrong and what to do next: logs, alerts and incident steps.',
  'Cloud and Application Security': 'Securing cloud services and the apps built on them, from settings to secure code.',
  'Resilience and Security Management': 'Policies, planning and recovery that keep an organisation running through an attack.'
};

/* A skill's score as a medal tier */
export function skillTier(score: number | null): { tier: 'bronze' | 'silver' | 'gold' | 'platinum'; label: string } | null {
  if (score === null) return null;
  if (score >= 90) return { tier: 'platinum', label: 'Expert' };
  if (score >= 75) return { tier: 'gold', label: 'Strong' };
  if (score >= 50) return { tier: 'silver', label: 'Solid' };
  return { tier: 'bronze', label: 'Learning' };
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
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'special';
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
  { id: 'first-shift', tier: 'bronze', name: 'First Shift', desc: 'Finish your first Today’s 10.', glyph: 'play',
    earned: (c) => c.state.stats.daysCompleted >= 1 },
  { id: 'clean-sweep', tier: 'silver', name: 'Clean Sweep', desc: 'Get all 10 right in a day.', glyph: 'check',
    earned: (c) => c.state.stats.cleanSweeps >= 1 },
  { id: 'no-help', tier: 'gold', name: 'No Help Needed', desc: 'A clean sweep without using a hint.', glyph: 'star',
    earned: (c) => c.state.stats.cleanNoHints >= 1 },
  { id: 'streak-3', tier: 'bronze', name: 'On a Roll', desc: 'A 3-day streak.', glyph: '3',
    progress: (c) => count(c.state.streak.best ?? 0, 3), earned: (c) => (c.state.streak.best ?? 0) >= 3 },
  { id: 'streak-7', tier: 'silver', name: 'Week on Watch', desc: 'A 7-day streak.', glyph: '7',
    progress: (c) => count(c.state.streak.best ?? 0, 7), earned: (c) => (c.state.streak.best ?? 0) >= 7 },
  { id: 'streak-30', tier: 'gold', name: 'Month on Duty', desc: 'A 30-day streak.', glyph: '30',
    progress: (c) => count(c.state.streak.best ?? 0, 30), earned: (c) => (c.state.streak.best ?? 0) >= 30 },
  { id: 'streak-100', tier: 'platinum', name: 'Centurion', desc: 'A 100-day streak.', glyph: '100',
    progress: (c) => count(c.state.streak.best ?? 0, 100), earned: (c) => (c.state.streak.best ?? 0) >= 100 },
  { id: 'bank-25', tier: 'bronze', name: 'Building the Bank', desc: 'Learn 25 questions.', glyph: 'stack',
    progress: (c) => count(c.learned, 25), earned: (c) => c.learned >= 25 },
  { id: 'bank-50', tier: 'silver', name: 'Well Read', desc: 'Learn 50 questions.', glyph: 'stack',
    progress: (c) => count(c.learned, 50), earned: (c) => c.learned >= 50 },
  { id: 'bank-100', tier: 'gold', name: 'Encyclopaedic', desc: 'Learn 100 questions.', glyph: 'stack',
    progress: (c) => count(c.learned, 100), earned: (c) => c.learned >= 100 },
  { id: 'locked-in', tier: 'silver', name: 'Locked In', desc: 'Get a question to full strength in Practice.', glyph: 'dots',
    earned: (c) => Object.values(c.state.srs).some((e) => e.box >= MAX_BOX) },
  { id: 'inbox-zero', tier: 'silver', name: 'Inbox Zero', desc: 'Clear every review that’s due in a day (at least 5).', glyph: 'tray',
    earned: (c) => c.state.stats.reviewsCleared >= 1 },
  { id: 'second-chance', tier: 'bronze', name: 'Second Chance', desc: 'Get a daily question right that you’d got wrong before.', glyph: 'loop',
    earned: (c) => c.state.stats.secondChance >= 1 },
  { id: 'specialist', tier: 'gold', name: 'Specialist', desc: 'Score 90+ in any category (from 10+ answers).', glyph: 'target',
    earned: (c) => c.rows.some((r) => r.score !== null && r.score >= 90 && r.n >= 10) },
  { id: 'all-rounder', tier: 'gold', name: 'All-Rounder', desc: 'Score 70+ in every category (from 10+ answers each).', glyph: 'web',
    progress: (c) => count(c.rows.filter((r) => r.score !== null && r.score >= 70 && r.n >= 10).length, c.rows.length),
    earned: (c) => c.rows.length > 0 && c.rows.every((r) => r.score !== null && r.score >= 70 && r.n >= 10) },
  { id: 'first-practice', tier: 'bronze', name: 'Back for More', desc: 'Play Practice for the first time.', glyph: 'cycle',
    earned: (c) => c.state.log.some((e) => e.m === 'practice') || Object.values(c.state.srs).some((e) => e.box > 1) },
  { id: 'first-blitz', tier: 'bronze', name: 'Off the Mark', desc: 'Finish your first round of Acronym Blitz.', glyph: 'bolt',
    earned: (c) => c.state.blitz.rounds >= 1 },
  { id: 'blitz-10', tier: 'bronze', name: 'Quick Draw', desc: 'Finish 10 rounds of Acronym Blitz.', glyph: '10',
    progress: (c) => count(c.state.blitz.rounds, 10), earned: (c) => c.state.blitz.rounds >= 10 },
  { id: 'blitz-25', tier: 'silver', name: 'Rapid Fire', desc: 'Score 25 or more in an Acronym Blitz round.', glyph: '25',
    earned: (c) => c.state.blitz.best >= 25 },
  { id: 'blitz-40', tier: 'gold', name: 'Lightning', desc: 'Score 40 or more in an Acronym Blitz round.', glyph: '40',
    earned: (c) => c.state.blitz.best >= 40 },
  { id: 'blitz-combo', tier: 'gold', name: 'Unbroken', desc: 'Keep a ×2 combo going for 15 answers in Acronym Blitz.', glyph: '×2',
    progress: (c) => count(c.state.blitz.comboBest, 15), earned: (c) => c.state.blitz.comboBest >= 15 },
  { id: 'first-phish', tier: 'bronze', name: 'Gone Phishing', desc: 'Finish your first round of Spot the Phish.', glyph: 'hook',
    earned: (c) => c.state.phish.rounds >= 1 },
  { id: 'phish-clean', tier: 'silver', name: 'Cool Head', desc: 'Finish a Spot the Phish round with no false alarms, catching at least 4 phish.', glyph: 'check',
    earned: (c) => c.state.phish.cleanRounds >= 1 },
  { id: 'phish-20', tier: 'gold', name: 'Unhookable', desc: 'Catch 20 phish in a row without letting one through.', glyph: '20',
    progress: (c) => count(c.state.phish.streakBest, 20), earned: (c) => c.state.phish.streakBest >= 20 },
  { id: 'phish-expert', tier: 'platinum', name: 'Expert Eye', desc: 'Get all 10 right in an Expert round of Spot the Phish.', glyph: 'eye',
    earned: (c) => c.state.phish.expertPerfect >= 1 },
  { id: 'early-bird', tier: 'special', name: 'Early Bird', desc: 'Finish Today’s 10 before 7am.', glyph: 'sun', hidden: true,
    earned: (c) => c.state.stats.earlyBird >= 1 },
  { id: 'night-owl', tier: 'special', name: 'Night Owl', desc: 'Finish Today’s 10 after 11pm.', glyph: 'moon', hidden: true,
    earned: (c) => c.state.stats.nightOwl >= 1 },
  { id: 'saved', tier: 'special', name: 'Saved by the Freeze', desc: 'A streak freeze kept your streak alive.', glyph: 'snow', hidden: true,
    earned: (c) => c.state.stats.freezesUsed >= 1 }
];

/* ---------- evaluate after every change ---------- */

/* practiceBank = questions plus Blitz acronyms, so acronym reviews count towards Inbox Zero */
export function evaluateProgress(state: State, bank: Question[], silent = false, practiceBank: Question[] = bank): void {
  const today = dateKey();

  // Inbox Zero: everything due is cleared, with at least 5 reviews answered today
  const reviewedToday = state.log.filter((e) => e.m === 'practice' && e.d === today).length;
  if (reviewedToday >= 5 && state.stats.lastCleared !== today && dueIds(state, practiceBank).length === 0) {
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
      state.badges[b.id] = new Date().toISOString(); // full time, so badges from the same day sort newest first
      if (!silent) state.celebrations.push({ kind: 'badge', id: b.id });
    }
  }

  // skills: celebrate the first time a category reaches silver, gold or platinum.
  // The first time this runs it just records where everyone is, so nobody gets a flood.
  const RANK = { bronze: 1, silver: 2, gold: 3, platinum: 4 } as const;
  const first = !state.skillTiers;
  const tiers = state.skillTiers ?? {};
  for (const r of ctx.rows) {
    const t = skillTier(r.score);
    const n = t ? RANK[t.tier] : 0;
    if (n > (tiers[r.name] ?? 0)) {
      if (!silent && !first && n >= 2) state.celebrations.push({ kind: 'skill', id: r.name, n });
      tiers[r.name] = n;
    }
  }
  state.skillTiers = tiers;
}

export function badgeContext(state: State, bank: Question[]): Ctx {
  return { state, learned: learnedIds(state, bank).length, rows: profileRows(state, bank) };
}
