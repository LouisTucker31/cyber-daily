import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BLITZ_MS, COMBO_AT, createDeck, FINAL_MS, PENALTY_MS,
  type Acronym, type BlitzQuestion, type BlitzResult
} from '../lib/blitz.ts';
import { LETTERS } from '../lib/quiz.ts';
import { haptic } from '../lib/haptics.ts';
import { CrossIcon, TickIcon } from './icons.tsx';

const FLASH_MS = 160; // how long the tapped answer shows right/wrong before the next one

/* ---------- before a round ---------- */

export function BlitzIntro({ best, xpLeft }: { best: number; xpLeft: number }) {
  return (
    <div className="blitz-intro">
      <h2 className="done-title">60 seconds. Go fast.</h2>
      <ul className="blitz-rules">
        <li>Pick what each acronym stands for. Now and then it’s the other way round.</li>
        <li>A wrong answer takes {PENALTY_MS / 1000} seconds off the clock.</li>
        <li>Get {COMBO_AT} right in a row for a ×2 combo. A wrong answer ends it.</li>
      </ul>
      <section className="stat-row two">
        <div className="stat">
          <span className="stat-value">{best || '–'}</span>
          <span className="stat-label">Your best</span>
        </div>
        <div className="stat">
          <span className="stat-value">{xpLeft}</span>
          <span className="stat-label">{xpLeft === 1 ? 'XP round' : 'XP rounds'} left today</span>
        </div>
      </section>
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
  onAnswer: (a: Acronym, ok: boolean) => void;
  onEnd: (r: BlitzResult) => void;
}

export function BlitzGame({ bank, onAnswer, onEnd }: GameProps) {
  const deck = useMemo(() => createDeck(bank), [bank]);
  const [q, setQ] = useState<BlitzQuestion>(() => deck.next(0));
  const [count, setCount] = useState(0);          // questions shown so far (keys the card animation)
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [secs, setSecs] = useState(BLITZ_MS / 1000);
  const [penalties, setPenalties] = useState(0);  // keys the "−3s" pop
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
    endAt.current = performance.now() + BLITZ_MS;
    let raf = 0;
    const tick = () => {
      const left = endAt.current - performance.now();
      if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0, left) / BLITZ_MS})`;
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
    if (ok) {
      s.score += s.streak >= COMBO_AT ? 2 : 1;
      s.correct += 1;
      s.streak += 1;
      s.comboHeld = Math.max(s.comboHeld, s.streak - COMBO_AT);
    } else {
      s.wrong += 1;
      s.streak = 0;
      if (!s.missed.includes(q.a.id)) s.missed.push(q.a.id);
      endAt.current -= PENALTY_MS;
      setPenalties((n) => n + 1);
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
          {penalties > 0 && <span key={penalties} className="blitz-penalty" aria-hidden="true">−{PENALTY_MS / 1000}s</span>}
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
  byId: Map<string, Acronym>;
}

export function BlitzDone({ result, prevBest, best, xp, byId }: DoneProps) {
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
          <span className="stat-value">{xp > 0 ? `+${xp}` : '0'}</span>
          <span className="stat-label">{xp > 0 ? 'XP' : 'XP · daily limit'}</span>
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
          <p className="p-note">{missed.length === 1 ? 'It’s' : 'They’re'} now in Practice for review.</p>
        </>
      ) : (
        <p className="p-note">{result.correct > 0 ? 'Every answer right. Clean round.' : 'No answers this round.'}</p>
      )}
    </>
  );
}
