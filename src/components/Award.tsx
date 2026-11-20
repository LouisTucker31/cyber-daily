import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../lib/haptics.ts';
import { confetti, stopConfetti } from '../lib/confetti.ts';

interface Props {
  art: ReactNode;     // the medal
  kicker: string;     // e.g. "Badge earned"
  title: string;
  body: string;
  onDone: () => void;
}

/* A badge or skill-up: a smaller version of the level-up. The medal drops in with one slam,
   a puff of confetti and a shine across it, the words rise in, it floats a moment, then fades.
   Tap anywhere to skip. */
const AT = { land: 280, reveal: 420, float: 900, leave: 4200 };
const FADE_MS = 350;

export default function Award({ art, kicker, title, body, onDone }: Props) {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<'in' | 'float'>(still ? 'float' : 'in');
  const [revealed, setRevealed] = useState(still);
  const [leaving, setLeaving] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const medal = useRef<HTMLDivElement>(null);
  const started = useRef(performance.now());
  const left = useRef(false);
  // the parent re-renders every second (the countdown); keep the latest onDone without restarting
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);

  const leave = useCallback(() => {
    if (left.current) return;
    left.current = true;
    setLeaving(true);
    window.setTimeout(() => done.current(), still ? 0 : FADE_MS);
  }, [still]);

  useEffect(() => {
    if (still) {
      haptic('success');
      const t = window.setTimeout(leave, AT.leave);
      return () => window.clearTimeout(t);
    }
    const timers = [
      window.setTimeout(() => {
        haptic('success');
        const r = medal.current!.getBoundingClientRect();
        confetti(canvas.current!, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, 'small');
      }, AT.land),
      window.setTimeout(() => setRevealed(true), AT.reveal),
      window.setTimeout(() => setPhase('float'), AT.float),
      window.setTimeout(leave, AT.leave)
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [leave, still]);

  useEffect(() => stopConfetti, []);

  return createPortal(
    <div
      className={`levelup award is-${phase}` + (revealed ? ' revealed' : '') + (leaving ? ' leaving' : '')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="aw-title"
      onClick={() => { if (performance.now() - started.current > 500) leave(); }}
    >
      <canvas ref={canvas} className="lu-confetti" aria-hidden="true" />
      <div className="lu-stage">
        <div className="aw-medal" ref={medal}>
          {art}
          <span className="aw-shine" aria-hidden="true" />
        </div>
        <div className="lu-text">
          <p className="lu-kicker">{kicker}</p>
          <h2 className="lu-title" id="aw-title">{title}</h2>
          <p className="lu-body">{body}</p>
        </div>
      </div>
      <p className="lu-hint">Tap to continue</p>
    </div>,
    document.body
  );
}
