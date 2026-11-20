/* Acronym Blitz: a 60-second speed round. No React in here. */
import { addDays, dateKey, INTERVALS, logAnswer, shuffle, type Question, type State } from './quiz.ts';
import { XP } from './progress.ts';

export interface Acronym {
  id: string;
  acronym: string;
  full: string;
  decoys: string[];   // 3 near-miss full names
  meaning: string;    // one plain-English line, shown on the end screen
  category: string;   // one of the question bank's categories
  tier: number;       // 1 common, 2 working knowledge, 3 specialist
}

export const START_MS = 60_000;      // the clock starts here and can never go above it
export const PENALTY_MS = 3_000;     // a wrong answer takes this off the clock
export const FINAL_MS = 10_000;      // the last stretch: orange bar, firmer haptics

/* A right answer adds time, but less as the round goes on, so even a fast
   player's round ends (about 2 minutes at most). */
export function bonusMs(rightSoFar: number): number {
  if (rightSoFar < 10) return 3_000;
  if (rightSoFar < 20) return 2_000;
  if (rightSoFar < 30) return 1_000;
  return 0;
}
export const COMBO_AT = 5;           // this many right in a row starts the ×2 combo
const REVERSE_CHANCE = 1 / 6;        // show the full name, pick the acronym

export function parseAcronyms(data: unknown): Acronym[] {
  if (!Array.isArray(data)) return [];
  return data.filter((a): a is Acronym => {
    const x = a as Acronym;
    return !!x && typeof x.id === 'string' && typeof x.acronym === 'string' && typeof x.full === 'string' &&
      Array.isArray(x.decoys) && x.decoys.length >= 3 && typeof x.meaning === 'string' &&
      typeof x.category === 'string' && [1, 2, 3].includes(x.tier);
  });
}

/* An acronym as a normal Practice question, so it reuses the boxes and strength dots. */
export function acronymQuestion(a: Acronym): Question {
  return {
    id: a.id,
    category: a.category,
    question: `What does ${a.acronym} stand for?`,
    options: [a.full, ...a.decoys.slice(0, 3)],
    correctIndex: 0,
    explanation: a.meaning
  };
}

/* ---------- drawing questions ---------- */

export interface BlitzQuestion {
  a: Acronym;
  reverse: boolean;   // true: shows the full name, options are acronyms
  options: string[];
  correct: number;    // index into options
}

/* Difficulty ramps up as the round goes on: common acronyms first, specialist ones later. */
function tierFor(n: number): number {
  const r = Math.random();
  if (n < 6) return 1;
  if (n < 14) return r < 0.4 ? 1 : 2;
  if (n < 24) return r < 0.6 ? 2 : 3;
  return r < 0.25 ? 2 : 3;
}

/* For reversed questions: other acronyms that look alike (same length, same first letter, same topic). */
function lookalikes(a: Acronym, bank: Acronym[]): string[] {
  const seen = new Set([a.acronym]);
  return bank
    .filter((b) => b.acronym !== a.acronym)
    .map((b) => ({
      b,
      score: (b.acronym.length === a.acronym.length ? 2 : 0) + (b.acronym[0] === a.acronym[0] ? 2 : 0) +
        (b.category === a.category ? 1 : 0) + (b.tier === a.tier ? 1 : 0) + Math.random() * 1.5
    }))
    .sort((x, y) => y.score - x.score)
    .map((x) => x.b.acronym)
    .filter((s) => (seen.has(s) ? false : (seen.add(s), true)))
    .slice(0, 3);
}

/* Draws questions for one round, without repeats until the bank runs out. */
export function createDeck(bank: Acronym[]) {
  const used = new Set<string>();
  let last = '';
  return {
    next(n: number): BlitzQuestion {
      const want = tierFor(n);
      let pool: Acronym[] = [];
      for (const t of [want, want - 1, want + 1, want - 2, want + 2]) {
        if (t < 1 || t > 3) continue;
        pool = bank.filter((a) => a.tier === t && !used.has(a.id));
        if (pool.length) break;
      }
      if (!pool.length) {
        used.clear();
        pool = bank.filter((a) => a.id !== last);
      }
      const a = shuffle(pool)[0];
      used.add(a.id);
      last = a.id;

      const reverse = n >= 2 && Math.random() < REVERSE_CHANCE;
      const options = reverse
        ? shuffle([a.acronym, ...lookalikes(a, bank)])
        : shuffle([a.full, ...a.decoys.slice(0, 3)]);
      return { a, reverse, options, correct: options.indexOf(reverse ? a.acronym : a.full) };
    }
  };
}

/* ---------- progress (these mutate the state passed in) ---------- */

export interface BlitzResult {
  score: number;      // points: 1 per right answer, 2 while on a combo
  correct: number;
  wrong: number;
  comboHeld: number;  // most answers in a row scored on the ×2 combo
  missed: string[];   // acronym ids, in the order they were missed
}

/* Every answer is logged (feeds the Profile). A miss puts the acronym into Practice. */
export function logBlitzAnswer(state: State, a: Acronym, ok: boolean): void {
  logAnswer(state, 'blitz', a.id, a.category, ok);
  if (ok) return; // a right answer in a speed round doesn't promote it in Practice
  const today = dateKey();
  if (!state.blitzReview.includes(a.id)) state.blitzReview.push(a.id);
  state.srs[a.id] = state.srs[a.id]
    ? { box: 1, due: addDays(today, INTERVALS[0]) }  // already in Practice: back to the start
    : { box: 1, due: today };                        // new: ready to practise straight away
}

/* Called when the clock runs out. Returns the previous best and the XP earned. */
export function finishBlitz(state: State, r: BlitzResult): { prevBest: number; xp: number } {
  const b = state.blitz;
  const prevBest = b.best;
  const today = dateKey();
  b.rounds += 1;
  b.correct += r.correct;
  b.best = Math.max(b.best, r.score);
  b.comboBest = Math.max(b.comboBest, r.comboHeld);
  if (b.xpDay !== today) { b.xpDay = today; b.xpRounds = 0; }
  let xp = 0;
  if (b.xpRounds < XP.blitzRoundsPerDay) {
    b.xpRounds += 1;
    xp = r.correct * XP.blitzCorrect + XP.blitzRound;
    state.xp += xp;
  }
  return { prevBest, xp };
}

export function xpRoundsLeft(state: State): number {
  const b = state.blitz;
  return b.xpDay === dateKey() ? Math.max(0, XP.blitzRoundsPerDay - b.xpRounds) : XP.blitzRoundsPerDay;
}
