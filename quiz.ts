/* Quiz logic: daily draw, progress and streak. No React in here. */

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
  streak: { count: number; last: string | null };
  day: Day | null;
  learned: string[];                    // every id ever answered correctly (feeds Practice)
  practiceSeen: Record<string, string>; // id -> date last practised
}

export interface PracticeItem {
  id: string;
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
    practiceSeen: {}
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
}

/* ---------- practice ----------
 * Draws from questions you've already answered correctly, least recently
 * practised first. Doesn't touch daily progress. */
export const PRACTICE_COUNT = 10;

export function learnedIds(state: State, bank: Question[]): string[] {
  const ids = new Set(bank.map((q) => q.id));
  return state.learned.filter((id) => ids.has(id));
}

export function drawPractice(bank: Question[], state: State, count = PRACTICE_COUNT): PracticeItem[] {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const ids = bySeenThenRandom(learnedIds(state, bank), state.practiceSeen).slice(0, count);
  const today = dateKey();
  ids.forEach((id) => { state.practiceSeen[id] = today; });
  return shuffle(ids).map((id) => ({
    id,
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
  if (state.streak.last === today) return;
  if (state.streak.last === dayBefore(today)) {
    state.streak.count += 1;
  } else {
    state.streak.count = 1;
  }
  state.streak.last = today;
}

export function shownStreak(state: State): number {
  const today = dateKey();
  const { count, last } = state.streak;
  if (!last) return 0;
  return last === today || last === dayBefore(today) ? count : 0;
}
