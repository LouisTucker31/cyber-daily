import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  addEffects, applyEffects, fill, GAUGES, gradeFor, holds, pickOutcomes, resolveOption,
  type Decision, type Effects, type Gauge, type Gauges, type IncidentBank, type IncidentResult,
  type Person, type Quality, type Run
} from '../lib/incident.ts';
import { haptic } from '../lib/haptics.ts';
import { shuffle } from '../lib/quiz.ts';
import { xpRateText } from '../lib/progress.ts';
import { XpNote } from './BlitzView.tsx';
import {
  ArrowIcon, ChatsIcon, CrossIcon, GaugeIcon, LockIcon, ReportIcon, TickIcon, TimerIcon, WarnIcon
} from './icons.tsx';

const AVATAR = ['#5b7fa6', '#7a6aa8', '#4f8f7a', '#b0754a', '#a85b6a', '#5f7287', '#3f7f95', '#8a6b3f'];
const colourFor = (key: string) => AVATAR[[...key].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % AVATAR.length];
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const QUALITY_ICON: Record<Quality, ReactNode> = { good: <TickIcon />, ok: <WarnIcon />, poor: <CrossIcon /> };

/* ---------- before an incident ---------- */

interface IntroProps {
  bank: IncidentBank;
  level: number;
  best: Record<string, string>;
  timed: boolean;
  onTimed: (on: boolean) => void;
  roundsToday: number;
  selected: string;                 // the scenario that Start will play
  onSelect: (id: string) => void;
}

export function IncidentIntro({ bank, level, best, timed, onTimed, roundsToday, selected, onSelect }: IntroProps) {
  const rules = [
    { tone: 'decide', icon: <ChatsIcon />, value: 'Decide', label: 'updates arrive in the chat; you make the call' },
    { tone: 'timer', icon: <TimerIcon />, value: 'Timers', label: 'urgent calls have a countdown' },
    { tone: 'gauge', icon: <GaugeIcon />, value: 'Gauges', label: 'every choice moves all four' },
    { tone: 'debrief', icon: <ReportIcon />, value: 'Debrief', label: 'a grade and what to improve' }
  ];
  return (
    <div className="blitz-intro">
      <h2 className="done-title">You’re in charge.</h2>
      <p className="done-sub">A cyber incident is unfolding. Make the calls, and watch what they lead to.</p>
      <div className="rule-grid">
        {rules.map((r) => (
          <div key={r.tone} className={'rule rule-' + r.tone}>
            <span className="rule-icon">{r.icon}</span>
            <span className="rule-value">{r.value}</span>
            <span className="rule-label">{r.label}</span>
          </div>
        ))}
      </div>

      <p className="section-label">Scenarios</p>
      <div className="ph-levels" role="radiogroup" aria-label="Scenario">
        {bank.scenarios.map((s) => {
          const locked = level < s.level;
          const playable = !locked && !s.soon;
          const on = s.id === selected;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={!playable}
              className={'ph-level ic-scenario' + (on ? ' on' : '') + (playable ? '' : ' locked')}
              onClick={() => { haptic(); onSelect(s.id); }}
            >
              <span className="ph-level-text">
                <b>{s.title}</b>
                <span>{locked ? `Unlocks at level ${s.level}` : s.soon ? 'Coming soon' : s.blurb}</span>
                {playable && <span className="ic-meta">About {s.minutes} minutes{best[s.id] ? ` · Best grade ${best[s.id]}` : ''}</span>}
              </span>
              <span className="ph-level-mark">{!playable ? <LockIcon /> : on ? <TickIcon /> : null}</span>
            </button>
          );
        })}
      </div>

      <button type="button" className="ic-toggle" role="switch" aria-checked={timed} onClick={() => { haptic(); onTimed(!timed); }}>
        <span className="ph-level-text"><b>Timers</b><span>{timed ? 'Urgent decisions have a countdown' : 'Take as long as you like'}</span></span>
        <span className={'switch' + (timed ? ' on' : '')} aria-hidden="true"><i /></span>
      </button>

      <p className="blitz-foot">
        <span>Best <b>{Object.values(best).sort()[0] ?? '–'}</b></span>
        <XpNote roundsToday={roundsToday} />
      </p>
    </div>
  );
}

/* ---------- the gauges ---------- */

function GaugeBars({ g, flash }: { g: Gauges; flash?: { d: Effects; n: number } | null }) {
  return (
    <div className="ic-gauges" role="group" aria-label="Gauges">
      {GAUGES.map(({ key, name }) => {
        const v = g[key];
        const d = flash?.d[key];
        return (
          <div key={key} className={'ic-gauge' + (v < 35 ? ' low' : v < 60 ? ' mid' : '')}>
            <span className="ic-gauge-name">
              {name}
              {d ? <b key={flash!.n} className={'ic-delta ' + (d > 0 ? 'up' : 'down')}>{d > 0 ? `+${d}` : `−${-d}`}</b> : null}
            </span>
            <span className="ic-bar" role="meter" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={name}>
              <i style={{ width: `${v}%` }} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- the incident room ---------- */

type FeedItem =
  | { kind: 'clock'; text: string }
  | { kind: 'msg'; from: string; text: string }
  | { kind: 'you'; text: string }
  | { kind: 'missed' };

interface GameProps {
  run: Run;
  people: Record<string, Person>;
  timed: boolean;
  onDecision: (category: string, id: string, ok: boolean) => void;
  onEnd: (r: IncidentResult) => void;
}

const TYPE_MS = 750;  // gap between messages arriving
const NEXT_MS = 1300; // pause after the last reply before the next update starts

export function IncidentGame({ run, people, timed, onDecision, onEnd }: GameProps) {
  const beats = run.scenario.beats ?? [];
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [g, setG] = useState<Gauges>(run.scenario.start ?? { c: 50, o: 70, t: 70, k: 70 });
  const gRef = useRef(g);
  const flags = useRef<string[]>([...run.flags]);
  const [beatIdx, setBeatIdx] = useState(-1);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [queue, setQueue] = useState<FeedItem[]>([]);
  const [answered, setAnswered] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]); // the options, shuffled for each decision
  const [flash, setFlash] = useState<{ d: Effects; n: number } | null>(null);
  const decisions = useRef<Decision[]>([]);
  const pendingOutcome = useRef<{ effects: Effects; decision: Omit<Decision, 'deltas'> } | null>(null);
  const ended = useRef(false);

  const beat = beatIdx >= 0 ? beats[beatIdx] : null;
  const typing = queue.length > 0;
  const deciding = !!beat?.options && !typing && !answered;
  const options = (beat?.options ?? []).filter((o) => !o.hidden && holds(o.if, flags.current))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const want = beat?.pick ?? 1;

  const applyGauges = useCallback((e: Effects): Effects => {
    const { gauges, deltas } = applyEffects(gRef.current, e);
    gRef.current = gauges;
    setG(gauges);
    if (Object.keys(deltas).length) setFlash({ d: deltas, n: Date.now() });
    return deltas;
  }, []);

  const end = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    onEnd({
      scenarioId: run.scenario.id, title: run.scenario.title, org: run.org, sys: run.sys,
      recap: (run.scenario.recap ?? []).filter((r) => holds(r.if, flags.current)).map((r) => fill(r.text, run)),
      flags: flags.current, gauges: gRef.current, grade: gradeFor(gRef.current), decisions: decisions.current
    });
  }, [onEnd, run]);

  /* Move to the next beat whose conditions fit, and queue its messages */
  const enter = useCallback((from: number) => {
    let i = from;
    while (i < beats.length && !holds(beats[i].if, flags.current)) i++;
    if (i >= beats.length) { end(); return; }
    const b = beats[i];
    setBeatIdx(i);
    setAnswered(false);
    setPicks([]);
    setOrder(shuffle((b.options ?? []).map((o) => o.id))); // so the best answer isn't always first
    const items: FeedItem[] = [{ kind: 'clock', text: fill(b.clock, run) }];
    if (b.outcomes) {
      const outs = pickOutcomes(b, flags.current);
      outs.forEach((o) => o.messages.forEach((m) => items.push({ kind: 'msg', from: m.from, text: fill(m.text, run) })));
      pendingOutcome.current = {
        effects: outs.reduce((acc, o) => addEffects(acc, o.effects), {} as Effects),
        decision: { beatId: b.id, clock: fill(b.clock, run), ask: null, timedOut: false,
          picks: outs.map((o) => ({ text: fill(o.messages[0]?.text ?? '', run), quality: o.quality, note: o.note })) }
      };
    } else {
      (b.messages ?? []).filter((m) => holds(m.if, flags.current))
        .forEach((m) => items.push({ kind: 'msg', from: m.from, text: fill(m.text, run) }));
    }
    setQueue((q) => [...q, ...items]);
  }, [beats, end, run]);

  useEffect(() => { enter(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // messages arrive one at a time, like a real chat
  useEffect(() => {
    if (!queue.length) return;
    const t = window.setTimeout(() => {
      if (still) { setFeed((f) => [...f, ...queue]); setQueue([]); return; }
      setFeed((f) => [...f, queue[0]]);
      setQueue((q) => q.slice(1));
      if (queue[0].kind === 'msg') haptic();
    }, still ? 0 : feed.length === 0 ? 300 : TYPE_MS);
    return () => window.clearTimeout(t);
  }, [queue, feed.length, still]);

  // a consequence beat applies its effects once its messages have arrived
  useEffect(() => {
    if (typing || answered || !beat?.outcomes || !pendingOutcome.current) return;
    const p = pendingOutcome.current;
    pendingOutcome.current = null;
    const deltas = applyGauges(p.effects);
    decisions.current.push({ ...p.decision, deltas });
    setAnswered(true);
  }, [typing, answered, beat, applyGauges]);

  // no Continue button: once the replies have arrived, the next update follows by itself
  const enterRef = useRef(enter);
  enterRef.current = enter;
  useEffect(() => {
    if (!answered || typing || beatIdx < 0) return;
    const t = window.setTimeout(() => enterRef.current(beatIdx + 1), still ? 500 : NEXT_MS);
    return () => window.clearTimeout(t);
  }, [answered, typing, beatIdx, still]);

  // keep the newest message in view
  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: still ? 'auto' : 'smooth' });
  }, [feed.length, deciding, answered, still]);

  const choose = useCallback((ids: string[], timedOut = false) => {
    if (!beat?.options || answered) return;
    const chosen = ids.map((id) => beat.options!.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o);
    const resolved = chosen.map((o) => ({ o, ...resolveOption(o, flags.current) }));
    flags.current = [...flags.current, ...chosen.flatMap((o) => o.set ?? [])];
    const total = resolved.reduce((acc, r) => addEffects(acc, r.effects), {} as Effects);
    const deltas = applyGauges(total);
    resolved.forEach((r) => onDecision(beat.category, `${run.scenario.id}:${beat.id}:${r.o.id}`, !timedOut && r.quality === 'good'));
    decisions.current.push({
      beatId: beat.id, clock: fill(beat.clock, run), ask: fill(beat.ask ?? '', run), timedOut, deltas,
      picks: resolved.map((r) => ({ text: fill(r.o.text, run), quality: r.quality, note: r.note }))
    });
    haptic(timedOut ? 'error' : 'tap');
    setAnswered(true);
    const items: FeedItem[] = timedOut ? [{ kind: 'missed' }] : [];
    if (!timedOut) items.push(...chosen.map((o) => ({ kind: 'you' as const, text: fill(o.text, run) })));
    chosen.forEach((o) => (o.reply ?? []).forEach((m) => items.push({ kind: 'msg', from: m.from, text: fill(m.text, run) })));
    setQueue((q) => [...q, ...items]);
  }, [beat, answered, applyGauges, onDecision, run]);

  // urgent decisions: when the countdown runs out, the "do nothing" outcome happens
  // (the latest choose is kept in a ref so re-renders don't restart the countdown)
  const timer = timed && deciding && beat?.timer && beat.timeout ? beat.timer : 0;
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  useEffect(() => {
    if (!timer) return;
    const out = beats[beatIdx]?.timeout;
    if (!out) return;
    const t = window.setTimeout(() => chooseRef.current([out], true), timer * 1000);
    return () => window.clearTimeout(t);
  }, [timer, beatIdx, beats]);

  const toggle = (id: string) => {
    haptic();
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < want ? [...p, id] : p));
  };

  const person = (key: string) => people[key] ?? { name: key, role: '' };

  return (
    <div className="incident">
      <GaugeBars g={g} flash={flash} />

      <div className="ic-feed" aria-live="polite">
        {feed.map((item, i) => {
          if (item.kind === 'clock') return <p key={i} className="ic-clock">{item.text}</p>;
          if (item.kind === 'missed') return <p key={i} className="ic-missed"><TimerIcon />Out of time. No decision was made.</p>;
          if (item.kind === 'you') return <p key={i} className="ic-you">{item.text}</p>;
          const p = person(item.from);
          return (
            <div key={i} className="ic-msg">
              <span className="avatar sq" style={{ background: colourFor(item.from) }} aria-hidden="true">{initials(p.name)}</span>
              <div className="ic-msg-main">
                <p className="ic-who"><b>{p.name}</b><span>{p.role}</span></p>
                <p className="ic-text">{item.text}</p>
              </div>
            </div>
          );
        })}
        {typing && <p className="ic-typing" aria-hidden="true"><i /><i /><i /></p>}
      </div>

      {deciding && beat && (
        <section key={beat.id} className="ic-decide">
          <p className="ic-ask">{fill(beat.ask ?? '', run)}</p>
          {timer > 0 && <span className="ic-timer" aria-hidden="true"><i style={{ animationDuration: `${timer}s` }} /></span>}
          <ul className="options">
            {options.map((o) => {
              const on = picks.includes(o.id);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    className={'option ic-option' + (on ? ' picked' : '')}
                    aria-pressed={want > 1 ? on : undefined}
                    onClick={() => (want > 1 ? toggle(o.id) : choose([o.id]))}
                  >
                    {want > 1 && <span className="ic-check" aria-hidden="true">{on && <TickIcon />}</span>}
                    <span>{fill(o.text, run)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {want > 1 && (
            <button type="button" className="btn ic-confirm" disabled={picks.length !== want} onClick={() => choose(picks)}>
              {picks.length === want ? 'Confirm' : `Pick ${want - picks.length} more`}<ArrowIcon />
            </button>
          )}
        </section>
      )}
    </div>
  );
}

/* ---------- the debrief ---------- */

const GRADE_LINE: Record<string, string> = {
  A: 'Calm, quick and by the book. A textbook response.',
  B: 'A solid response with a couple of costly moments.',
  C: 'You got through it, but it hurt more than it needed to.',
  D: 'Some calls made things worse. The debrief shows where.',
  E: 'A rough one. Every incident is a lesson; here’s yours.'
};

interface DebriefProps {
  result: IncidentResult;
  prevBest: string | null;
  xp: number;
  rate: number;
}

export function IncidentDebrief({ result, prevBest, xp, rate }: DebriefProps) {
  const all = result.decisions.flatMap((d) => d.picks.map((p) => ({ ...p, clock: d.clock, decided: d.ask !== null })));
  const well = all.filter((p) => p.quality === 'good' && p.decided).slice(0, 4);
  const improve = all.filter((p) => p.quality === 'poor');
  const better = prevBest && result.grade < prevBest;

  return (
    <div className="ic-debrief">
      <div className="ic-grade-row">
        <span className={'ic-grade g-' + result.grade} aria-label={`Grade ${result.grade}`}>{result.grade}</span>
        <div>
          <h2 className="done-title">Grade {result.grade}</h2>
          <p className="done-sub">{GRADE_LINE[result.grade]}</p>
        </div>
      </div>
      <p className="p-note">
        {result.title} at {result.org}.
        {better ? ` Up from ${prevBest}.` : prevBest ? ` Your best is ${prevBest}.` : ''}
        {' '}+{xp} XP{rate < 1 ? ` (${xpRateText(rate)})` : ''}
      </p>

      <GaugeBars g={result.gauges} />

      <p className="section-label">This time</p>
      <ul className="ic-facts">
        {result.recap.map((line, i) => (
          <li key={i}>{line.split('**').map((part, j) => (j % 2 ? <b key={j}>{part}</b> : part))}</li>
        ))}
      </ul>
      <p className="p-note">These change each time you play.</p>

      {well.length > 0 && (
        <>
          <p className="section-label">What went well</p>
          <ul className="ic-points good">{well.map((p, i) => <li key={i}><TickIcon /><span>{p.note}</span></li>)}</ul>
        </>
      )}
      {improve.length > 0 && (
        <>
          <p className="section-label">What to improve</p>
          <ul className="ic-points poor">{improve.map((p, i) => <li key={i}><CrossIcon /><span>{p.note}</span></li>)}</ul>
        </>
      )}

      <p className="section-label">Timeline</p>
      <ol className="ic-timeline">
        {result.decisions.map((d, i) => (
          <li key={i}>
            <span className="ic-tl-clock">{d.clock}</span>
            {d.ask && <p className="ic-tl-ask">{d.ask}</p>}
            {d.timedOut && <p className="ic-tl-missed"><TimerIcon />Ran out of time</p>}
            {d.picks.map((p, j) => (
              <p key={j} className={'ic-tl-pick q-' + p.quality}>
                {QUALITY_ICON[p.quality]}<span>{d.ask ? p.text : p.note}</span>
              </p>
            ))}
            {d.ask && d.picks.map((p, j) => p.note && <p key={'n' + j} className="ic-tl-note">{p.note}</p>)}
            <span className="ic-tl-deltas">
              {(Object.keys(d.deltas) as Gauge[]).map((k) => {
                const v = d.deltas[k]!;
                return <b key={k} className={v > 0 ? 'up' : 'down'}>{GAUGES.find((x) => x.key === k)!.name} {v > 0 ? `+${v}` : `−${-v}`}</b>;
              })}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

