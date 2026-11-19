import { useEffect } from 'react';

/* iPhone-style "swipe from the left edge to go back".
   The page follows your finger; let go past a third of the screen and it goes back,
   otherwise it springs back into place. */
export default function useEdgeSwipe(enabled: boolean, onBack: () => void): void {
  useEffect(() => {
    if (!enabled) return;
    const EDGE = 28;
    let active = false;
    let decided = false;
    let startX = 0;
    let startY = 0;
    let dx = 0;

    const targets = () => Array.from(document.querySelectorAll<HTMLElement>('.app, .actionbar'));
    const setStyle = (transform: string, transition: string) =>
      targets().forEach((el) => { el.style.transition = transition; el.style.transform = transform; });

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || t.clientX > EDGE) return;
      active = true; decided = false; dx = 0;
      startX = t.clientX; startY = t.clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0];
      dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (!decided) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx) || dx < 0) { active = false; return; } // it's a scroll
        decided = true;
        document.documentElement.classList.add('swiping');
      }
      e.preventDefault();
      setStyle(`translateX(${Math.max(0, dx)}px)`, 'none');
    };

    const onEnd = () => {
      if (!active) return;
      active = false;
      if (!decided) return;
      const w = window.innerWidth;
      if (dx > w * 0.3) {
        setStyle(`translateX(${w}px)`, 'transform .2s ease-out');
        setTimeout(() => {
          setStyle('', '');
          document.documentElement.classList.remove('swiping');
          onBack();
        }, 200);
      } else {
        setStyle('', 'transform .3s cubic-bezier(.2,.9,.25,1)');
        setTimeout(() => {
          setStyle('', '');
          document.documentElement.classList.remove('swiping');
        }, 300);
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, onBack]);
}
