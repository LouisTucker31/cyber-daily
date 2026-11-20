import { useCallback, useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  onClose: () => void;
  labelledBy: string;
  /** Long content: the sheet scrolls, and only its top strip drags it down */
  scroll?: boolean;
  /** Gets a close function that slides the sheet away first, then runs `then` */
  children: (close: (then?: () => void) => void) => ReactNode;
}

const CLOSE_MS = 220;
const SWIPE_CLOSE = 90; // drag down this far (px) to dismiss

/* Bottom sheet that slides up like an iOS sheet. Close it by swiping it down,
   tapping outside it, pressing Escape, or with a button inside. */
export default function Sheet({ onClose, labelledBy, scroll = false, children }: Props) {
  const [closing, setClosing] = useState(false);
  const [drag, setDrag] = useState(0);
  const startY = useRef<number | null>(null);
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

  const onTouchStart = (e: TouchEvent) => {
    const y = e.touches[0].clientY;
    // a scrolling sheet only drags from its top strip, so the rest can scroll
    if (scroll && y - e.currentTarget.getBoundingClientRect().top > 56) return;
    startY.current = y;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (startY.current === null) return;
    setDrag(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    startY.current = null;
    if (drag > SWIPE_CLOSE) close();
    else setDrag(0);
  };

  // rendered into <body> so the screen's slide animation can't affect its fixed position
  return createPortal(
    <div className={'sheet-backdrop' + (closing ? ' closing' : '')} onClick={() => close()}>
      <div
        className={'sheet' + (scroll ? ' scroll' : '') + (drag ? ' dragging' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={drag ? { transform: `translateY(${drag}px)` } : undefined}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <span className="sheet-grabber" aria-hidden="true" />
        {children(close)}
      </div>
    </div>,
    document.body
  );
}
