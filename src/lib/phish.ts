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

/* ---------- the cast: fictional organisations, a different mix every round ----------
   Cards are written with placeholders such as {E} (employer name), {Eslug} (its domain name),
   {Edig} (a look-alike with a digit), {Bs} (bank's short name) and so on. Each round picks one
   employer, bank, delivery company and energy supplier and fills them in. */

export type Cast = Record<string, string>;
export interface Casts { employer: Cast[]; bank: Cast[]; delivery: Cast[]; energy: Cast[] }
export interface PhishBank { casts: Casts; cards: PhishCard[] }

export function parsePhish(data: unknown): PhishBank | null {
  const d = data as PhishBank;
  if (!d || !Array.isArray(d.cards) || !d.casts) return null;
  const ok = (['employer', 'bank', 'delivery', 'energy'] as const).every((k) => Array.isArray(d.casts[k]) && d.casts[k].length > 0);
  const cards = d.cards.filter((c) => c && typeof c.id === 'string' && [1, 2, 3].includes(c.tier) &&
    typeof c.phish === 'boolean' && Array.isArray(c.points) && typeof c.lesson === 'string');
  return ok && cards.length >= ROUND ? { casts: d.casts, cards } : null;
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/* A new random cast, avoiding the last one's employer where possible */
export function pickCast(casts: Casts, previous?: Cast | null): Cast {
  const employers = casts.employer.length > 1 && previous
    ? casts.employer.filter((e) => e.E !== previous.E) : casts.employer;
  return { ...pick(employers), ...pick(casts.bank), ...pick(casts.delivery), ...pick(casts.energy) };
}

/* The card with the cast's names filled in */
export function applyCast(card: PhishCard, cast: Cast): PhishCard {
  return JSON.parse(JSON.stringify(card).replace(/\{([A-Za-z]+)\}/g, (m, k: string) => cast[k] ?? m));
}

/* ---------- the Directory: just enough to check every card ---------- */

export type DirIcon = 'web' | 'phone' | 'text';
export interface DirectoryEntry {
  org: string;
  role: string;
  rows: { icon: DirIcon; value: string; label: string }[];
  rules: string[];
}

export function directoryFor(c: Cast): DirectoryEntry[] {
  return [
    {
      org: c.E, role: 'Your employer',
      rows: [
        { icon: 'web', value: `${c.Eslug}.co.uk`, label: '' },
        { icon: 'phone', value: c.Ephone, label: 'IT' }
      ],
      rules: ['IT never asks for passwords or codes', 'Outside messages are tagged External',
        'Bank details change only after a call-back']
    },
    {
      org: c.B, role: 'Your bank',
      rows: [
        { icon: 'web', value: `${c.Bslug}.co.uk`, label: '' },
        { icon: 'text', value: c.Bs, label: 'texts from' },
        { icon: 'phone', value: c.Bphone, label: 'fraud' }
      ],
      rules: ['No sign-in links in texts', 'Never asks you to move money']
    },
    {
      org: c.D, role: 'Deliveries',
      rows: [
        { icon: 'web', value: `${c.Dslug}.co.uk`, label: '' },
        { icon: 'text', value: `${c.Dlink}.uk`, label: 'short links' }
      ],
      rules: ['Redelivery is always free']
    },
    {
      org: c.N, role: 'Energy',
      rows: [
        { icon: 'web', value: `${c.Nslug}.co.uk`, label: '' },
        { icon: 'phone', value: c.Nphone, label: '' }
      ],
      rules: ['Refunds are automatic, never claimed']
    }
  ];
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

/* Picks a round:
   - the right mix of difficulty for the level
   - a varying number of phish (4 to 7, so it's never a predictable 50/50)
   - cards you haven't seen recently first
   - a spread of card types (no more than 3 of a kind), dealt so the same type rarely comes twice in a row */
export function drawRound(cards: PhishCard[], tier: Tier, seen: Record<string, number>, round: number): PhishCard[] {
  const phishWanted = 4 + Math.floor(Math.random() * 4);
  const typeCount: Record<string, number> = {};
  // 0: never seen, 1: seen a while ago, 2: seen in the last 2 rounds
  const age = (c: PhishCard) => (seen[c.id] === undefined ? 0 : seen[c.id] >= round - 2 ? 2 : 1);

  const take = (pool: PhishCard[], n: number): PhishCard[] => {
    const out: PhishCard[] = [];
    const left = shuffle(pool);
    while (out.length < n && left.length) {
      left.sort((a, b) => age(a) - age(b) ||
        Math.min(typeCount[a.type] ?? 0, 3) - Math.min(typeCount[b.type] ?? 0, 3) ||
        (seen[a.id] ?? -1) - (seen[b.id] ?? -1));
      const c = left.shift()!;
      out.push(c);
      typeCount[c.type] = (typeCount[c.type] ?? 0) + 1;
    }
    return out;
  };

  const quota = MIX[tier];
  const picked: PhishCard[] = [];
  let phishLeft = phishWanted;
  let slotsLeft = ROUND;
  ([1, 2, 3] as Tier[]).forEach((t, i) => {
    const q = quota[i];
    if (!q) return;
    const pool = cards.filter((c) => c.tier === t);
    // this tier's share of the phish, kept within what's left
    const p = Math.min(Math.round((q * phishLeft) / slotsLeft), q);
    const got = [...take(pool.filter((c) => c.phish), p)];
    got.push(...take(pool.filter((c) => !c.phish), q - got.length));
    // not enough of one kind: top up with the other
    if (got.length < q) got.push(...take(pool.filter((c) => !got.includes(c)), q - got.length));
    picked.push(...got);
    phishLeft -= got.filter((c) => c.phish).length;
    slotsLeft -= q;
  });
  return spread(picked);
}

/* Orders the round so the same card type doesn't come twice in a row (when it can be helped) */
function spread(cards: PhishCard[]): PhishCard[] {
  const left = shuffle(cards);
  const out: PhishCard[] = [];
  while (left.length) {
    const count = (type: string) => left.filter((c) => c.type === type).length;
    const prev = out[out.length - 1]?.type;
    // the most common remaining type goes first, so it gets spaced out
    const order = [...left].sort((a, b) => count(b.type) - count(a.type));
    const next = order.find((c) => c.type !== prev) ?? order[0];
    out.push(next);
    left.splice(left.indexOf(next), 1);
  }
  return out;
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
