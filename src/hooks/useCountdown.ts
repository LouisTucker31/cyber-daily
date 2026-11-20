import { useEffect, useState } from 'react';
import { dateKey } from '../lib/quiz.ts';

function timeToMidnight(): string {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const s = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/* Ticking "hh:mm:ss until midnight" (always 8 characters, so the pill never changes width). Calls onNewDay once the date changes. */
export default function useCountdown(dayDate: string | undefined, onNewDay: () => void): string {
  const [remaining, setRemaining] = useState(timeToMidnight);
  useEffect(() => {
    const t = setInterval(() => {
      if (dayDate && dateKey() !== dayDate) onNewDay();
      else setRemaining(timeToMidnight());
    }, 1000);
    return () => clearInterval(t);
  }, [dayDate, onNewDay]);
  return remaining;
}
