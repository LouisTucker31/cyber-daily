/* Incident Commander: a tabletop exercise on the phone. No React in here.
   A scenario is a list of beats on a pretend clock. Each beat brings messages from the cast and
   either a decision (options that move the gauges and set flags) or outcomes (consequences of
   earlier flags). A few facts are rolled at the start of each play, so it plays out differently. */
import { dateKey, logAnswer, type State } from './quiz.ts';
import { gameXpRate } from './progress.ts';

export type Gauge = 'c' | 'o' | 't' | 'k';
export const GAUGES: { key: Gauge; name: string }[] = [
  { key: 'c', name: 'Containment' },
  { key: 'o', name: 'Operations' },
  { key: 't', name: 'Trust' },
  { key: 'k', name: 'Compliance' }
];
export type Gauges = Record<Gauge, number>;
export type Effects = Partial<Gauges>;
export type Quality = 'good' | 'ok' | 'poor';

export interface Msg { from: string; text: string; if?: string[] }
export interface Option {
  id: string;
  text: string;
  effects?: Effects;
  set?: string[];
  quality: Quality;
  note?: string;
  reply?: Msg[];
  hidden?: boolean;       // only happens when the timer runs out
  if?: string[];
  variants?: { if: string[]; effects?: Effects; note?: string; quality?: Quality }[];
}
export interface Outcome { if: string[]; all?: boolean; messages: Msg[]; effects: Effects; quality: Quality; note: string }
export interface Beat {
  id: string;
  clock: string;
  category: string;
  if?: string[];
  messages?: Msg[];
  ask?: string;
  timer?: number;          // seconds, for urgent decisions
  timeout?: string;        // option that happens if the timer runs out
  pick?: number;           // pick this many (default 1)
  options?: Option[];
  outcomes?: Outcome[];
}
export interface Scenario {
  id: string;
  title: string;
  level: number;
  minutes: number;
  blurb: string;
  soon?: boolean;
  facts?: { sys: string[]; backupsClean: number; stolen: number };
  start?: Gauges;
  beats?: Beat[];
}
export interface Person { name: string; role: string }
export interface IncidentBank { orgs: string[]; people: Record<string, Person>; scenarios: Scenario[] }

export function parseIncident(data: unknown): IncidentBank | null {
  const d = data as IncidentBank;
  if (!d || !Array.isArray(d.scenarios) || !Array.isArray(d.orgs) || !d.people) return null;
  return d.scenarios.some((s) => !s.soon && Array.isArray(s.beats) && s.beats.length) ? d : null;
}

/* ---------- a play ---------- */

export interface Run {
  scenario: Scenario;
  org: string;
  sys: string;
  flags: string[];   // starts with the rolled facts (backupsClean, stolen)
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

export function newRun(bank: IncidentBank, scenario: Scenario): Run {
  const f = scenario.facts;
  const flags: string[] = [];
  if (f && Math.random() < f.backupsClean) flags.push('backupsClean');
  if (f && Math.random() < f.stolen) flags.push('stolen');
  return { scenario, org: pick(bank.orgs), sys: f ? pick(f.sys) : 'the network', flags };
}

/* Conditions: every flag must be set ("x") or not set ("!x") */
export const holds = (conds: string[] | undefined, flags: string[]) =>
  (conds ?? []).every((c) => (c.startsWith('!') ? !flags.includes(c.slice(1)) : flags.includes(c)));

export const fill = (text: string, run: Run) => text
  .replace(/\{org\}/g, run.org)
  .replace(/\{sys\}/g, run.sys)
  .replace(/\{Sys\}/g, run.sys[0].toUpperCase() + run.sys.slice(1));

/* An option's effects, note and quality, after any variant that fits the facts */
export function resolveOption(o: Option, flags: string[]): { effects: Effects; note: string; quality: Quality } {
  const v = o.variants?.find((x) => holds(x.if, flags));
  return { effects: v?.effects ?? o.effects ?? {}, note: v?.note ?? o.note ?? '', quality: v?.quality ?? o.quality };
}

/* Which outcomes happen. "all" outcomes stack; otherwise the first that fits (the last one is the fallback). */
export function pickOutcomes(b: Beat, flags: string[]): Outcome[] {
  const outs = b.outcomes ?? [];
  const stacked = outs.filter((o) => o.all && holds(o.if, flags));
  if (stacked.length) return stacked;
  const first = outs.find((o) => !o.all && holds(o.if, flags));
  return first ? [first] : [];
}

export function addEffects(a: Effects, b: Effects): Effects {
  const out: Effects = { ...a };
  (Object.keys(b) as Gauge[]).forEach((k) => { out[k] = (out[k] ?? 0) + (b[k] ?? 0); });
  return out;
}

/* Applies effects, keeping each gauge between 0 and 100. Returns the new gauges and the real change. */
export function applyEffects(g: Gauges, e: Effects): { gauges: Gauges; deltas: Effects } {
  const gauges = { ...g };
  const deltas: Effects = {};
  (Object.keys(e) as Gauge[]).forEach((k) => {
    const next = Math.max(0, Math.min(100, gauges[k] + (e[k] ?? 0)));
    if (next !== gauges[k]) deltas[k] = next - gauges[k];
    gauges[k] = next;
  });
  return { gauges, deltas };
}

export const average = (g: Gauges) => Math.round((g.c + g.o + g.t + g.k) / 4);

export function gradeFor(g: Gauges): string {
  const a = average(g);
  return a >= 82 ? 'A' : a >= 70 ? 'B' : a >= 58 ? 'C' : a >= 45 ? 'D' : 'E';
}

/* ---------- the debrief record ---------- */

export interface Decision {
  beatId: string;
  clock: string;
  ask: string | null;                                   // null for consequences (no decision)
  picks: { text: string; quality: Quality; note: string }[];
  timedOut: boolean;
  deltas: Effects;
}

export interface IncidentResult {
  scenarioId: string;
  title: string;
  org: string;
  sys: string;
  flags: string[];
  gauges: Gauges;
  grade: string;
  decisions: Decision[];
}

/* ---------- progress (these mutate the state passed in) ---------- */

export function logIncidentDecision(state: State, category: string, id: string, ok: boolean): void {
  logAnswer(state, 'incident', id, category, ok);
}

const GRADE_XP: Record<string, number> = { A: 60, B: 45, C: 32, D: 22, E: 12 };

/* Called at the end of an incident. Returns the previous best grade, the XP earned and its rate. */
export function finishIncident(state: State, r: IncidentResult): { prevBest: string | null; xp: number; rate: number } {
  const s = state.incident;
  const prevBest = s.best[r.scenarioId] ?? null;
  const today = dateKey();
  s.rounds += 1;
  if (!prevBest || r.grade < prevBest) s.best[r.scenarioId] = r.grade; // 'A' sorts before 'B'
  if (r.grade === 'A') s.aGrades += 1;
  if (r.flags.includes('stolen') && r.flags.includes('icoReported')) s.icoOnTime += 1;
  if (s.xpDay !== today) { s.xpDay = today; s.xpRounds = 0; }
  const rate = gameXpRate(s.xpRounds);
  s.xpRounds += 1;
  const xp = Math.max(1, Math.round((GRADE_XP[r.grade] ?? 12) * rate));
  state.xp += xp;
  return { prevBest, xp, rate };
}

export function incidentRoundsToday(state: State): number {
  return state.incident.xpDay === dateKey() ? state.incident.xpRounds : 0;
}
