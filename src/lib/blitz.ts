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

/* Draws questions for one round. Nothing repeats within a round.
   Across rounds: acronyms you haven't got right yet (new ones and misses) come first, at random.
   Ones you got right stay away until the fresh ones in that difficulty run out, then the
   longest-ago come back first. rightAt: acronym id -> round it was last answered right. */
export function createDeck(bank: Acronym[], rightAt: Record<string, number> = {}) {
  const used = new Set<string>();
  let last = '';
  const near = (t: number) => [t, t - 1, t + 1].filter((x) => x >= 1 && x <= 3);
  return {
    next(n: number): BlitzQuestion {
      const want = tierFor(n);
      const open = (t: number) => bank.filter((a) => a.tier === t && !used.has(a.id));
      let a: Acronym | undefined;
      // 1. fresh, in this tier or the one next to it
      for (const t of near(want)) {
        const fresh = open(t).filter((x) => rightAt[x.id] === undefined);
        if (fresh.length) { a = shuffle(fresh)[0]; break; }
      }
      // 2. otherwise the one got right longest ago (ties at random)
      if (!a) {
        for (const t of [...near(want), want + 2, want - 2]) {
          const pool = open(t);
          if (!pool.length) continue;
          a = shuffle(pool).sort((x, y) => (rightAt[x.id] ?? -1) - (rightAt[y.id] ?? -1))[0];
          break;
        }
      }
      // 3. the whole bank used in one round: start again
      if (!a) {
        used.clear();
        a = shuffle(bank.filter((x) => x.id !== last))[0];
      }
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
  if (ok) {
    state.blitz.rightAt[a.id] = state.blitz.rounds; // rest it for the next rounds
    return; // a right answer in a speed round doesn't promote it in Practice
  }
  delete state.blitz.rightAt[a.id]; // a miss can come back next round (never in the same one)
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
