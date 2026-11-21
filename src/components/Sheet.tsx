import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  onClose: () => void;
  labelledBy: string;
  /** Long content: the sheet scrolls; dragging down only moves the sheet once it's scrolled to the top */
  scroll?: boolean;
  /** Gets a close function that slides the sheet away first, then runs `then` */
  children: (close: (then?: () => void) => void) => ReactNode;
}

const CLOSE_MS = 220;
const SWIPE_CLOSE = 90; // drag down this far (px) to dismiss
const FLICK = 0.5;      // or flick down faster than this (px per ms)
const SLOP = 8;         // movement before we decide whether it's a drag or a scroll

/* Bottom sheet that slides up like an iOS sheet. Close it by swiping down anywhere on it,
   tapping outside it, pressing Escape, or with a button inside. */
export default function Sheet({ onClose, labelledBy, scroll = false, children }: Props) {
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const sheet = useRef<HTMLDivElement>(null);
  const closed = useRef(false);

  const close = useCallback((then?: () => void) => {
    if (closed.current) return;
    closed.current = true;
    setClosing(true);
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => { onClose(); then?.(); }, still ? 0 : CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // the latest close, read by the touch listeners below (the parent re-renders often, e.g. the countdown clock,
  // and re-attaching the listeners mid-swipe would lose the gesture)
  const closeRef = useRef(close);
  closeRef.current = close;

  /* Native listeners, so touchmove can be non-passive and stop the page/sheet scrolling while dragging.
     Attached once; all gesture state lives here, outside React. */
  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    let g: { y: number; t: number; mode: 'undecided' | 'drag' | 'scroll'; d: number } | null = null;

    const start = (e: TouchEvent) => {
      g = { y: e.touches[0].clientY, t: e.timeStamp, mode: 'undecided', d: 0 };
    };
    const move = (e: TouchEvent) => {
      if (!g || g.mode === 'scroll') return;
      const dy = e.touches[0].clientY - g.y;
      if (g.mode === 'undecided') {
        if (Math.abs(dy) < SLOP) return;
        // pulling down with the content at its top drags the sheet; anything else is a normal scroll
        g.mode = dy > 0 && el.scrollTop <= 0 ? 'drag' : 'scroll';
        if (g.mode === 'scroll') return;
        g.y = e.touches[0].clientY; // start the drag from here, so it doesn't jump by the slop
        g.t = e.timeStamp;
      }
      e.preventDefault();
      g.d = Math.max(0, e.touches[0].clientY - g.y);
      setDrag(g.d);
    };
    const end = (e: TouchEvent) => {
      if (g?.mode === 'drag') {
        const speed = g.d / Math.max(1, e.timeStamp - g.t);
        if (g.d > SWIPE_CLOSE || (g.d > 24 && speed > FLICK)) closeRef.current();
        else setDrag(0);
      }
      g = null;
    };

    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
    };
  }, []);

  // rendered into <body> so the screen's slide animation can't affect its fixed position
  return createPortal(
    <div className={'sheet-backdrop' + (closing ? ' closing' : '')} onClick={() => close()}>
      <div
        ref={sheet}
        className={'sheet' + (scroll ? ' scroll' : '') + (drag ? ' dragging' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="sheet-grabber" aria-hidden="true" />
        {children(close)}
      </div>
    </div>,
    document.body
  );
}
