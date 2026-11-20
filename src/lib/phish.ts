/* Spot the Phish: 10 cards a round, swipe right for Legit, left for Phish. No React in here. */
import { dateKey, logAnswer, shuffle, type State } from './quiz.ts';
import { XP } from './progress.ts';

export const CATEGORY = 'Phishing and Social Engineering';
export const ROUND = 10;

export type CardType = 'email' | 'sms' | 'chat' | 'link' | 'mfa' | 'login' | 'consent' | 'voicemail';

/* A warning sign (phish) or a reason it's safe (genuine). Either points at a part of the card
   (`at`: from, replyTo, external, subject, attachment, link0.., url, publisher, scopes, prompt)
   or at a phrase in its text (`quote`). */
export interface Point { at?: string; quote?: string; note: string }

export interface PhishCard {
  id: string;
  tier: 1 | 2 | 3;
  type: CardType;
  phish: boolean;
  context?: string;
  from?: { name: string; address?: string };
  replyTo?: string;
  external?: boolean;
  subject?: string;
  time?: string;
  body?: string[];               // paragraphs; [[0]] marks where links[0] goes
  links?: { text: string; url: string }[];
  attachment?: string;
  url?: string;                  // login, consent and link cards
  page?: { brand: string; heading: string };
  consent?: { app: string; publisher: string; verified: boolean; scopes: string[] };
  mfa?: { app: string; title: string; lines: string[] };
  points: Point[];
  lesson: string;                // one line for the end screen
}

export interface DirectoryEntry { org: string; note: string; rows: [string, string][]; rules: string[] }
export interface PhishBank { directory: DirectoryEntry[]; cards: PhishCard[] }

export function parsePhish(data: unknown): PhishBank | null {
  const d = data as PhishBank;
  if (!d || !Array.isArray(d.cards) || !Array.isArray(d.directory)) return null;
  const cards = d.cards.filter((c) => c && typeof c.id === 'string' && [1, 2, 3].includes(c.tier) &&
    typeof c.phish === 'boolean' && Array.isArray(c.points) && typeof c.lesson === 'string');
  return cards.length >= ROUND ? { directory: d.directory, cards } : null;
}

/* ---------- levels ---------- */

export type Tier = 1 | 2 | 3;
export const TIERS: { tier: Tier; name: string; unlock: number; desc: string }[] = [
  { tier: 1, name: 'Rookie', unlock: 1, desc: 'Clear giveaways if you look' },
  { tier: 2, name: 'Analyst', unlock: 4, desc: 'Look-alikes, hidden details, real-looking traps' },
  { tier: 3, name: 'Expert', unlock: 7, desc: 'The subtlest tricks, and genuine ones that look risky' }
];

/* How many cards from each tier make up a round at each level */
const MIX: Record<Tier, [number, number, number]> = { 1: [10, 0, 0], 2: [3, 7, 0], 3: [1, 3, 6] };

/* Picks a round: the right mix of difficulty, a varying number of phish (4 to 7, never 50/50 every time),
   and cards you haven't seen recently first. */
export function drawRound(cards: PhishCard[], tier: Tier, seen: Record<string, number>): PhishCard[] {
  const phishWanted = 4 + Math.floor(Math.random() * 4);
  const freshest = (list: PhishCard[]) =>
    shuffle(list).sort((a, b) => (seen[a.id] ?? -1) - (seen[b.id] ?? -1));
  const quota = MIX[tier];
  const picked: PhishCard[] = [];
  let phishLeft = phishWanted;
  let slotsLeft = ROUND;
  ([1, 2, 3] as Tier[]).forEach((t, i) => {
    const q = quota[i];
    if (!q) return;
    const pool = cards.filter((c) => c.tier === t);
    // share of this tier's slots that should be phish, rounded, kept within what's left
    let p = Math.round((q * phishLeft) / slotsLeft);
    const phish = freshest(pool.filter((c) => c.phish));
    const legit = freshest(pool.filter((c) => !c.phish));
    p = Math.min(p, phish.length, q);
    const l = Math.min(q - p, legit.length);
    const take = [...phish.slice(0, p), ...legit.slice(0, l)];
    // not enough of one kind: top up with the other
    const rest = freshest([...phish.slice(p), ...legit.slice(l)]);
    while (take.length < q && rest.length) take.push(rest.shift()!);
    picked.push(...take);
    phishLeft -= take.filter((c) => c.phish).length;
    slotsLeft -= q;
  });
  return shuffle(picked);
}

/* ---------- scoring ---------- */

export type Verdict = 'caught' | 'trusted' | 'fooled' | 'false-alarm';

export function verdictFor(card: PhishCard, saidPhish: boolean): Verdict {
  if (card.phish) return saidPhish ? 'caught' : 'fooled';
  return saidPhish ? 'false-alarm' : 'trusted';
}

/* Out of 100: 10 for each right call. A false alarm still earns 3 (cautious beats fooled),
   letting a phish through earns nothing. */
export const POINTS: Record<Verdict, number> = { caught: 10, trusted: 10, 'false-alarm': 3, fooled: 0 };

export interface PhishResult {
  tier: Tier;
  score: number;
  verdicts: { id: string; v: Verdict }[];
}

/* ---------- progress (these mutate the state passed in) ---------- */

export function logPhishAnswer(state: State, card: PhishCard, saidPhish: boolean): void {
  const v = verdictFor(card, saidPhish);
  logAnswer(state, 'phish', card.id, CATEGORY, v === 'caught' || v === 'trusted');
  const p = state.phish;
  p.seen[card.id] = p.rounds;
  if (v === 'caught') {
    p.caught += 1;
    p.streak += 1;
    p.streakBest = Math.max(p.streakBest, p.streak);
  } else if (v === 'fooled') {
    p.streak = 0;
  }
}

/* Called after the last card. Returns the previous best and the XP earned. */
export function finishPhish(state: State, r: PhishResult): { prevBest: number; xp: number } {
  const p = state.phish;
  const prevBest = p.best;
  const today = dateKey();
  const count = (v: Verdict) => r.verdicts.filter((x) => x.v === v).length;
  const right = count('caught') + count('trusted');
  p.rounds += 1;
  p.best = Math.max(p.best, r.score);
  if (count('false-alarm') === 0 && count('caught') >= 4) p.cleanRounds += 1;
  if (r.tier === 3 && right === r.verdicts.length) p.expertPerfect += 1;
  if (p.xpDay !== today) { p.xpDay = today; p.xpRounds = 0; }
  let xp = 0;
  if (p.xpRounds < XP.phishRoundsPerDay) {
    p.xpRounds += 1;
    xp = right * (XP.phishCorrect + (r.tier - 1)) + XP.phishRound;
    state.xp += xp;
  }
  return { prevBest, xp };
}

export function phishXpRoundsLeft(state: State): number {
  const p = state.phish;
  return p.xpDay === dateKey() ? Math.max(0, XP.phishRoundsPerDay - p.xpRounds) : XP.phishRoundsPerDay;
}

/* The domain a URL really goes to, for the browser address bar */
export function hostOf(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}
