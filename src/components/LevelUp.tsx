import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RANKS } from '../lib/progress.ts';
import { haptic } from '../lib/haptics.ts';
import { confetti, stopConfetti } from '../lib/confetti.ts';
import { LevelRing } from './Badge.tsx';

interface Props {
  level: number;     // the level just reached
  progress: number;  // progress through it (0 to 1)
  onDone: () => void;
}

/* Timeline (ms). The old level slams in, spins into the new one, which slams down with confetti,
   then floats for a few seconds and fades away. Tap anywhere to skip. */
const AT = { land: 270, spin: 800, swap: 1250, slam: 1750, float: 2300, leave: 6000 };
const FADE_MS = 400;

type Phase = 'in' | 'spin' | 'slam' | 'float';

export default function LevelUp({ level, progress, onDone }: Props) {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<Phase>(still ? 'float' : 'in');
  const [shown, setShown] = useState(still ? level : Math.max(1, level - 1));
  const [leaving, setLeaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const disc = useRef<HTMLDivElement>(null);
  const started = useRef(performance.now());
  const left = useRef(false);

  const rank = RANKS[level - 1] ?? RANKS[RANKS.length - 1];
  const next = RANKS[level] ?? null;

  // the parent re-renders every second (the countdown), handing over a new onDone each time;
  // keep the latest in a ref so the timeline below runs once and isn't restarted
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);

  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    setLeaving(true);
    window.setTimeout(() => done.current(), still ? 0 : FADE_MS);
  }, [still]);

  useEffect(() => {
    const centre = () => {
      const r = disc.current!.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    if (still) {
      haptic('success');
      const t = window.setTimeout(leave, AT.leave);
      return () => window.clearTimeout(t);
    }
    const timers = [
      window.setTimeout(() => haptic('tap', true), AT.land),
      window.setTimeout(() => { setPhase('spin'); confetti(canvas.current!, centre(), 'small'); }, AT.spin),
      window.setTimeout(() => setShown(level), AT.swap),
      window.setTimeout(() => { setPhase('slam'); haptic('success', true); confetti(canvas.current!, centre(), 'big'); }, AT.slam),
      window.setTimeout(() => setPhase('float'), AT.float),
      window.setTimeout(leave, AT.leave)
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [level, leave, still]);

  useEffect(() => stopConfetti, []);

  const revealed = phase === 'slam' || phase === 'float';

  return createPortal(
    <div
      className={`levelup is-${phase}` + (revealed ? ' revealed' : '') + (leaving ? ' leaving' : '')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lu-title"
      onClick={() => { if (performance.now() - started.current > 900) leave(); }}
    >
      <canvas ref={canvas} className="lu-confetti" aria-hidden="true" />
      <div className="lu-stage">
        <div className="lu-coin">
          <div className="lu-spin">
            <div className="lu-disc" ref={disc}>
              <LevelRing key={shown} level={shown} progress={shown === level ? progress : 1} size={148}
                animate={shown === level} />
            </div>
          </div>
        </div>
        <div className="lu-text">
          <p className="lu-kicker">Level up</p>
          <h2 className="lu-title" id="lu-title">{rank.name}</h2>
          <p className="lu-body">
            Congratulations, you’ve reached level {level}.
            {next ? ` Next up: ${next.name}.` : ' That’s the top rank.'}
          </p>
        </div>
      </div>
      <p className="lu-hint">Tap to continue</p>
    </div>,
    document.body
  );
}
