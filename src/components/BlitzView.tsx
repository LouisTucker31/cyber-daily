import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  bonusMs, COMBO_AT, createDeck, FINAL_MS, PENALTY_MS, START_MS,
  type Acronym, type BlitzQuestion, type BlitzResult
} from '../lib/blitz.ts';
import { LETTERS } from '../lib/quiz.ts';
import { FULL_XP_ROUNDS, gameXpRate, xpRateText } from '../lib/progress.ts';
import { haptic } from '../lib/haptics.ts';
import { BlitzIcon, ClockIcon, CrossIcon, TickIcon } from './icons.tsx';

const FLASH_MS = 160; // how long the tapped answer shows right/wrong before the next one

/* How much XP the next round pays: full for the first few each day, then it tapers */
export function XpNote({ roundsToday }: { roundsToday: number }) {
  const left = Math.max(0, FULL_XP_ROUNDS - roundsToday);
  if (left > 0) return <span><b>{left}</b> full-XP {left === 1 ? 'round' : 'rounds'} left today</span>;
  const t = xpRateText(gameXpRate(roundsToday));
  return <span>{t[0].toUpperCase() + t.slice(1)} now · full again tomorrow</span>;
}

/* ---------- before a round ---------- */

export function BlitzIntro({ best, roundsToday }: { best: number; roundsToday: number }) {
  const rules = [
    { tone: 'clock', icon: <ClockIcon />, value: `${START_MS / 1000}s`, label: 'on the clock to start' },
    { tone: 'good', icon: <TickIcon />, value: `+${bonusMs(0) / 1000}s`, label: 'for a right answer, less as you go' },
    { tone: 'bad', icon: <CrossIcon />, value: `−${PENALTY_MS / 1000}s`, label: 'for a wrong answer' },
    { tone: 'combo', icon: <BlitzIcon />, value: '×2', label: `points after ${COMBO_AT} right in a row` }
  ];
  return (
    <div className="blitz-intro">
      <h2 className="done-title">Beat the clock.</h2>
      <p className="done-sub">Pick what each acronym stands for. Keep going until your time runs out.</p>
      <div className="rule-grid">
        {rules.map((r) => (
          <div key={r.tone} className={'rule rule-' + r.tone}>
            <span className="rule-icon">{r.icon}</span>
            <span className="rule-value">{r.value}</span>
            <span className="rule-label">{r.label}</span>
          </div>
        ))}
      </div>
      <p className="blitz-foot">
        <span>Best <b>{best || '–'}</b></span>
        <XpNote roundsToday={roundsToday} />
      </p>
    </div>
  );
}

/* ---------- the round ---------- */

function ComboMeter({ streak }: { streak: number }) {
  if (streak >= COMBO_AT) {
    return <span className="combo on" aria-label={`×2 combo, ${streak} in a row`}>×2 combo <b>{streak}</b></span>;
  }
  return (
    <span className="combo" aria-label={`${streak} of ${COMBO_AT} towards a combo`}>
      {Array.from({ length: COMBO_AT }, (_, i) => <i key={i} className={i < streak ? 'on' : ''} />)}
    </span>
  );
}

interface GameProps {
  bank: Acronym[];
  rightAt: Record<string, number>;
  onAnswer: (a: Acronym, ok: boolean) => void;
  onEnd: (r: BlitzResult) => void;
}

export function BlitzGame({ bank, rightAt, onAnswer, onEnd }: GameProps) {
  const [deck] = useState(() => createDeck(bank, rightAt)); // made once per round
  const [q, setQ] = useState<BlitzQuestion>(() => deck.next(0));
  const [count, setCount] = useState(0);          // questions shown so far (keys the card animation)
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [secs, setSecs] = useState(START_MS / 1000);
  const [delta, setDelta] = useState<{ n: number; text: string; plus: boolean } | null>(null); // the "+3s" / "−3s" pop
  const [flash, setFlash] = useState<{ idx: number; ok: boolean } | null>(null);

  const stats = useRef({ score: 0, correct: 0, wrong: 0, streak: 0, comboHeld: 0, missed: [] as string[], asked: 0 });
  const endAt = useRef(0);
  const ended = useRef(false);
  const bar = useRef<HTMLElement>(null);
  const flashTimer = useRef(0);

  const onEndRef = useRef(onEnd);
  useLayoutEffect(() => { onEndRef.current = onEnd; });

  // the clock: a timestamp, so it can't drift; the bar is drawn straight to the DOM every frame
  useEffect(() => {
    endAt.current = performance.now() + START_MS;
    let raf = 0;
    const tick = () => {
      const left = endAt.current - performance.now();
      if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0, left) / START_MS})`;
      setSecs(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0) {
        if (!ended.current) {
          ended.current = true;
          const s = stats.current;
          onEndRef.current({ score: s.score, correct: s.correct, wrong: s.wrong, comboHeld: s.comboHeld, missed: s.missed });
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clearTimeout(flashTimer.current); };
  }, []);

  const pick = (idx: number) => {
    if (flash || ended.current) return;
    const ok = idx === q.correct;
    const s = stats.current;
    haptic(ok ? 'success' : 'error', endAt.current - performance.now() <= FINAL_MS);
    const now = performance.now();
    if (ok) {
      // time bonus, but the clock never goes above where it started
      const before = endAt.current;
      endAt.current = Math.min(before + bonusMs(s.correct), now + START_MS);
      const added = Math.round((endAt.current - before) / 1000);
      if (added > 0) setDelta((d) => ({ n: (d?.n ?? 0) + 1, text: `+${added}s`, plus: true }));
      s.score += s.streak >= COMBO_AT ? 2 : 1;
      s.correct += 1;
      s.streak += 1;
      s.comboHeld = Math.max(s.comboHeld, s.streak - COMBO_AT);
    } else {
      s.wrong += 1;
      s.streak = 0;
      if (!s.missed.includes(q.a.id)) s.missed.push(q.a.id);
      endAt.current -= PENALTY_MS;
      setDelta((d) => ({ n: (d?.n ?? 0) + 1, text: `−${PENALTY_MS / 1000}s`, plus: false }));
    }
    setScore(s.score);
    setStreak(s.streak);
    setFlash({ idx, ok });
    onAnswer(q.a, ok);
    flashTimer.current = window.setTimeout(() => {
      s.asked += 1;
      setQ(deck.next(s.asked));
      setCount(s.asked);
      setFlash(null);
    }, FLASH_MS);
  };

  const final = secs <= FINAL_MS / 1000;

  return (
    <div className={'blitz' + (final ? ' final' : '')}>
      <div className="blitz-clock" aria-hidden="true"><i ref={bar} /></div>

      <div className="blitz-meta">
        <span className="blitz-score">Score <b key={score}>{score}</b></span>
        <ComboMeter streak={streak} />
        <span className="blitz-time" role="timer" aria-label={`${secs} seconds left`}>
          {secs}s
          {delta && (
            <span key={delta.n} className={'blitz-delta ' + (delta.plus ? 'plus' : 'minus')} aria-hidden="true">{delta.text}</span>
          )}
        </span>
      </div>

      <div key={count} className="blitz-card">
        <p className="blitz-prompt">{q.reverse ? 'Which acronym is this?' : 'What does it stand for?'}</p>
        <h2 className={'blitz-term' + (q.reverse ? ' long' : '')}>{q.reverse ? q.a.full : q.a.acronym}</h2>
        <ul className="options">
          {q.options.map((text, i) => {
            const picked = flash?.idx === i;
            let cls = 'option';
            if (picked) cls += flash!.ok ? ' picked-right' : ' picked-wrong';
            return (
              <li key={i}>
                <button type="button" className={cls} disabled={!!flash} onClick={() => pick(i)}>
                  <span className="key">{picked ? (flash!.ok ? <TickIcon /> : <CrossIcon />) : LETTERS[i]}</span>
                  <span>{text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ---------- after a round ---------- */

interface DoneProps {
  result: BlitzResult;
  prevBest: number;
  best: number;
  xp: number;
  rate: number;           // the XP rate this round was paid at
  byId: Map<string, Acronym>;
}

export function BlitzDone({ result, prevBest, best, xp, rate, byId }: DoneProps) {
  const newBest = result.score > prevBest && result.score > 0;
  const missed = result.missed.map((id) => byId.get(id)).filter((a): a is Acronym => !!a);

  return (
    <>
      <h2 className="done-title">{newBest ? 'New best.' : 'Time.'}</h2>
      <p className="done-sub">
        <b>{result.score} {result.score === 1 ? 'point' : 'points'}</b>.{' '}
        {newBest ? (prevBest > 0 ? `Up from ${prevBest}.` : 'That’s the score to beat.') : `Your best is ${best}.`}
      </p>

      <section className="stat-row">
        <div className="stat">
          <span className="stat-value">{result.correct}</span>
          <span className="stat-label">Right</span>
        </div>
        <div className="stat">
          <span className="stat-value">{result.wrong}</span>
          <span className="stat-label">Wrong</span>
        </div>
        <div className="stat">
          <span className="stat-value">+{xp}</span>
          <span className="stat-label">{rate === 1 ? 'XP' : `XP · ${xpRateText(rate)}`}</span>
        </div>
      </section>

      <p className="section-label">{missed.length ? 'Missed' : 'Nothing missed'}</p>
      {missed.length > 0 ? (
        <>
          <ul className="recap">
            {missed.map((a) => (
              <li key={a.id} className="wrong">
                <span><CrossIcon /></span>
                <span>
                  <b className="recap-term">{a.acronym}</b> {a.full}
                  <span className="recap-meaning">{a.meaning}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="p-note">{missed.length === 1 ? 'It’s' : 'They’re'} now in Smart Practice for review.</p>
        </>
      ) : (
        <p className="p-note">{result.correct > 0 ? 'Every answer right. Clean round.' : 'No answers this round.'}</p>
      )}
    </>
  );
}
