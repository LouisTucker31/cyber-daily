/* Quiz logic: daily draw, progress and streak. No React in here. */

import { applyFreezes, levelFor, onDayComplete, XP } from './progress.ts';

export const DAILY_COUNT = 10;
export const STORE_KEY = 'cyberDaily10.state.v1'; // same key as the original app, so progress carries over
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface Question {
  id: string;
  category?: string;
  question: string;
  options: string[];
  correctIndex: number;
  hint?: string;
  explanation?: string;
}

export interface DayItem {
  id: string;
  review: boolean;        // top-up question already mastered; doesn't affect progress
  order: number[];        // shuffled answer order (display index -> original index)
  chosen: number | null;  // display index picked
  correct: boolean | null;
  hint: boolean;
}

export interface Day {
  date: string;
  items: DayItem[];
  index: number;
  completed: boolean;
}

export interface State {
  cycle: number;
  mastered: string[];               // ids answered correctly this cycle
  lastSeen: Record<string, string>; // id -> date key last shown
  prevSet: string[];                // ids shown on the previous day
  streak: { count: number; last: string | null; best?: number };
  day: Day | null;
  learned: string[];                    // every id ever answered correctly (feeds Practice; never resets)
  practiceSeen: Record<string, string>; // (legacy, no longer used)
  srs: Record<string, SrsEntry>;        // spaced-repetition box + next due date per learned question
  log: LogEntry[];                      // every answer, tagged by category (feeds the Profile)
  xp: number;
  levelSeen: number;                    // highest level already celebrated
  badges: Record<string, string>;       // badge id -> date earned
  freezes: number;                      // streak freezes held (max 2)
  stats: Stats;
  celebrations: Celebration[];          // level-ups, badges etc. waiting to be shown
}

export interface Stats {
  daysCompleted: number;
  cleanSweeps: number;
  cleanNoHints: number;
  secondChance: number;
  reviewsCleared: number;
  lastCleared?: string;
  freezesUsed: number;
  earlyBird: number;
  nightOwl: number;
}

export interface Celebration {
  kind: 'level' | 'badge' | 'freeze-earned' | 'freeze-used' | 'welcome';
  id?: string;
  n?: number;
}

function freshStats(): Stats {
  return { daysCompleted: 0, cleanSweeps: 0, cleanNoHints: 0, secondChance: 0, reviewsCleared: 0,
    freezesUsed: 0, earlyBird: 0, nightOwl: 0 };
}

/* Spaced repetition: 5 boxes. A right answer moves a question up a box, a wrong one sends it
   back to box 1. Box 1 comes back after 1 day, then 3, 7, 14 and 30 days. */
export const INTERVALS = [1, 3, 7, 14, 30];
export const MAX_BOX = INTERVALS.length;

export interface SrsEntry {
  box: number;   // 1..5
  due: string;   // date key it's next due
}

export interface LogEntry {
  d: string;                     // date key
  m: 'daily' | 'practice';       // which mode (more modes later)
  id: string;
  c: string;                     // category
  ok: boolean;
}

const LOG_LIMIT = 3000;

export interface PracticeItem {
  id: string;
  early: boolean;        // not due yet when drawn (a right answer won't promote it)
  order: number[];
  chosen: number | null;
  correct: boolean | null;
  hint: boolean;
}

export interface PracticeSession {
  items: PracticeItem[];
  index: number;
}

/* ---------- dates & randomness ---------- */

export function dateKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function dayBefore(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return dateKey(date);
}

function randInt(n: number): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / n) * n;
    do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % n;
  }
  return Math.floor(Math.random() * n);
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- state ---------- */

export function freshState(): State {
  return {
    cycle: 1,
    mastered: [],
    lastSeen: {},
    prevSet: [],
    streak: { count: 0, last: null },
    day: null,
    learned: [],
    practiceSeen: {},
    srs: {},
    log: [],
    xp: 0,
    levelSeen: 1,
    badges: {},
    freezes: 0,
    stats: freshStats(),
    celebrations: []
  };
}

export function loadState(): State {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return freshState();
    const s: State = { ...freshState(), ...(JSON.parse(raw) as Partial<State>) };
    // older versions had no 'learned' list: rebuild it from what we know was answered correctly
    const learned = new Set([...s.learned, ...s.mastered]);
    s.day?.items.forEach((it) => { if (it.correct) learned.add(it.id); });
    s.learned = [...learned];
    // questions learned before Smart Practice existed start in box 1, due now
    const today = dateKey();
    s.learned.forEach((id) => { if (!s.srs[id]) s.srs[id] = { box: 1, due: today }; });

    // first run with levels & badges: give credit for what's already been done
    if ((JSON.parse(raw) as Partial<State>).xp === undefined) {
      const done = !!s.day?.completed;
      s.stats = freshStats();
      s.stats.daysCompleted = Math.max(s.streak.count, done ? 1 : 0);
      if (done && s.day!.items.every((it) => it.correct)) {
        s.stats.cleanSweeps = 1;
        if (s.day!.items.every((it) => !it.hint)) s.stats.cleanNoHints = 1;
      }
      s.streak.best = s.streak.count;
      s.xp = s.learned.length * XP.dailyCorrect + s.stats.daysCompleted * XP.dailyComplete +
        s.stats.cleanSweeps * XP.cleanSweep;
      s.levelSeen = levelFor(s.xp);
      s.celebrations = [{ kind: 'welcome' }];
    }
    s.stats = { ...freshStats(), ...s.stats };
    return s;
  } catch {
    return freshState();
  }
}

export function saveState(state: State): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* storage full or blocked */ }
}

export function parseBank(data: unknown): Question[] {
  const list = Array.isArray(data) ? data : (data as { questions?: unknown[] })?.questions;
  return (list ?? []).filter((q): q is Question => {
    const x = q as Question;
    return !!x && !!x.id && !!x.question && Array.isArray(x.options) && x.options.length >= 2 &&
      typeof x.correctIndex === 'number' && x.correctIndex >= 0 && x.correctIndex < x.options.length;
  });
}

/* ---------- daily draw ----------
 * 1. Pool = questions not yet answered correctly this cycle.
 * 2. If the pool is empty, a new cycle starts and every question goes back in.
 * 3. Yesterday's questions are held back, so you never get the same one two
 *    days running (unless there's nothing else left).
 * 4. Questions you haven't seen for longest come first, random among equals.
 * 5. If fewer than 10 remain, the rest are topped up with already-mastered
 *    "review" questions (least recently seen first). Reviews don't change progress.
 */
function bySeenThenRandom(ids: string[], lastSeen: Record<string, string>): string[] {
  return shuffle(ids).sort((a, b) => {
    const sa = lastSeen[a] || '';
    const sb = lastSeen[b] || '';
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });
}

export function drawDailySet(bank: Question[], state: State, count = DAILY_COUNT): DayItem[] {
  const allIds = bank.map((q) => q.id);
  const idSet = new Set(allIds);

  let mastered = new Set(state.mastered.filter((id) => idSet.has(id)));
  let pool = allIds.filter((id) => !mastered.has(id));
  if (pool.length === 0) {
    state.cycle += 1;
    mastered = new Set();
    pool = allIds.slice();
  }
  state.mastered = [...mastered];

  const prev = new Set(state.prevSet);
  const preferred = bySeenThenRandom(pool.filter((id) => !prev.has(id)), state.lastSeen);
  const heldBack = bySeenThenRandom(pool.filter((id) => prev.has(id)), state.lastSeen);
  const chosen = preferred.concat(heldBack).slice(0, count);

  const picked: { id: string; review: boolean }[] = shuffle(chosen).map((id) => ({ id, review: false }));

  if (picked.length < count) {
    const taken = new Set(chosen);
    const spare = allIds.filter((id) => !taken.has(id));
    const spareFresh = bySeenThenRandom(spare.filter((id) => !prev.has(id)), state.lastSeen);
    const spareHeld = bySeenThenRandom(spare.filter((id) => prev.has(id)), state.lastSeen);
    spareFresh.concat(spareHeld).slice(0, count - picked.length)
      .forEach((id) => picked.push({ id, review: true }));
  }

  const byId = new Map(bank.map((q) => [q.id, q]));
  return picked.map(({ id, review }) => ({
    id,
    review,
    order: shuffle(byId.get(id)!.options.map((_, i) => i)), // answers shuffled every time
    chosen: null,
    correct: null,
    hint: false
  }));
}

/* ---------- day lifecycle (these mutate the state passed in) ---------- */

export function ensureToday(state: State, bank: Question[]): void {
  const today = dateKey();
  const ids = new Set(bank.map((q) => q.id));
  if (state.day && state.day.date === today) {
    // drop any questions that were removed from the JSON since
    state.day.items = state.day.items.filter((it) => ids.has(it.id));
    if (state.day.index > state.day.items.length) state.day.index = state.day.items.length;
    return;
  }
  if (state.day) state.prevSet = state.day.items.map((it) => it.id);
  applyFreezes(state);
  const items = drawDailySet(bank, state);
  items.forEach((it) => { state.lastSeen[it.id] = today; });
  state.day = { date: today, items, index: 0, completed: false };
}

export function answer(state: State, bank: Question[], displayIdx: number): void {
  const day = state.day;
  if (!day) return;
  const item = day.items[day.index];
  if (!item || item.chosen !== null) return;
  const q = bank.find((x) => x.id === item.id);
  if (!q) return;
  item.chosen = displayIdx;
  item.correct = item.order[displayIdx] === q.correctIndex;
  if (item.correct && !item.review && !state.mastered.includes(item.id)) {
    state.mastered.push(item.id);
  }
  if (item.correct && !state.learned.includes(item.id)) state.learned.push(item.id);
  if (item.correct) {
    state.xp += XP.dailyCorrect;
    if (state.log.some((e) => e.id === item.id && e.m === 'daily' && !e.ok)) state.stats.secondChance += 1;
  }
  recordResult(state, q, 'daily', item.correct);
}

/* ---------- spaced repetition & answer log ---------- */

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + n));
}

export function daysUntil(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  const [ty, tm, td] = dateKey().split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000);
}

/* Log every answer and move the question through the boxes. */
export function recordResult(state: State, q: Question, mode: LogEntry['m'], ok: boolean): void {
  const today = dateKey();
  state.log.push({ d: today, m: mode, id: q.id, c: q.category || 'General', ok });
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);

  const entry = state.srs[q.id];
  if (mode === 'practice' && ok) state.xp += entry && entry.due > today ? XP.practiceEarly : XP.practiceDue;
  if (ok) {
    if (!entry) {
      state.srs[q.id] = { box: 1, due: addDays(today, INTERVALS[0]) }; // just learned: first review tomorrow
    } else if (entry.due > today) {
      // reviewed early: no promotion (stops grinding), the schedule stays as it is
    } else {
      const box = Math.min(MAX_BOX, entry.box + 1);
      state.srs[q.id] = { box, due: addDays(today, INTERVALS[box - 1]) };
    }
  } else if (entry) {
    state.srs[q.id] = { box: 1, due: addDays(today, INTERVALS[0]) };
  }
  // a wrong answer to a question you haven't learned yet doesn't enter Practice
}

/* Accuracy per category from your most recent answers (all modes). */
export function categoryAccuracy(state: State, recent = 20): Map<string, number> {
  const byCat = new Map<string, boolean[]>();
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    const list = byCat.get(e.c) ?? [];
    if (list.length < recent) list.push(e.ok);
    byCat.set(e.c, list);
  }
  const out = new Map<string, number>();
  byCat.forEach((list, c) => out.set(c, list.filter(Boolean).length / list.length));
  return out;
}

/* ---------- Smart Practice ----------
 * A round of up to 10 from every question you've ever learned (never resets):
 * 1. Questions due for review, most overdue and lowest box first.
 * 2. Then questions from your weakest categories, lowest box first.
 * 3. The last couple of slots are random, for variety.
 * Doesn't touch daily progress. */
export const PRACTICE_COUNT = 10;

export function learnedIds(state: State, bank: Question[]): string[] {
  const ids = new Set(bank.map((q) => q.id));
  return state.learned.filter((id) => ids.has(id));
}

export function dueIds(state: State, bank: Question[]): string[] {
  const today = dateKey();
  return learnedIds(state, bank).filter((id) => (state.srs[id]?.due ?? today) <= today);
}

export function drawPractice(bank: Question[], state: State, count = PRACTICE_COUNT): PracticeItem[] {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const today = dateKey();
  const srs = (id: string): SrsEntry => state.srs[id] ?? { box: 1, due: today };
  const learned = shuffle(learnedIds(state, bank)); // shuffled first so ties are random

  const due = learned
    .filter((id) => srs(id).due <= today)
    .sort((a, b) => (srs(a).due < srs(b).due ? -1 : srs(a).due > srs(b).due ? 1 : srs(a).box - srs(b).box));
  const picked = due.slice(0, count);

  if (picked.length < count) {
    const acc = categoryAccuracy(state);
    const weakness = (id: string) => 1 - (acc.get(byId.get(id)?.category || 'General') ?? 0.5);
    const taken = new Set(picked);
    const rest = learned.filter((id) => !taken.has(id));
    const randomSlots = Math.min(2, count - picked.length);
    const focused = rest
      .slice()
      .sort((a, b) => weakness(b) - weakness(a) || srs(a).box - srs(b).box)
      .slice(0, count - picked.length - randomSlots);
    focused.forEach((id) => taken.add(id));
    const random = shuffle(rest.filter((id) => !taken.has(id))).slice(0, randomSlots);
    picked.push(...focused, ...random);
  }

  return shuffle(picked).map((id) => ({
    id,
    early: srs(id).due > today,
    order: shuffle(byId.get(id)!.options.map((_, i) => i)),
    chosen: null,
    correct: null,
    hint: false
  }));
}

export function completeDay(state: State): void {
  const day = state.day;
  if (!day || day.completed) return;
  day.completed = true;
  const today = day.date;
  if (state.streak.last !== today) {
    state.streak.count = state.streak.last === dayBefore(today) ? state.streak.count + 1 : 1;
    state.streak.last = today;
  }
  onDayComplete(state);
}

export function shownStreak(state: State): number {
  const today = dateKey();
  const { count, last } = state.streak;
  if (!last) return 0;
  return last === today || last === dayBefore(today) ? count : 0;
}
