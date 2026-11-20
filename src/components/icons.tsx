/* Interface icons. Most come from Lucide (lucide.dev, ISC licence) so they're consistent and crisp;
   the badge medals and their glyphs are drawn separately in Badge.tsx. */
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, FishingHook,
  Globe, Link, Lock, MessageSquare, Paperclip, Phone, Play, Pointer, RefreshCw, ShieldCheck, TriangleAlert, X, Zap,
  type LucideIcon
} from 'lucide-react';

const icon = (I: LucideIcon, strokeWidth = 2) =>
  function Icon({ className }: { className?: string }) {
    return <I aria-hidden="true" focusable="false" strokeWidth={strokeWidth} className={className} />;
  };

export const TickIcon = icon(Check, 2.4);
export const CrossIcon = icon(X, 2.4);
export const ArrowIcon = icon(ArrowRight);
export const ArrowLeftIcon = icon(ArrowLeft);
export const BackIcon = icon(ChevronLeft, 2.4);
export const ChevronRightIcon = icon(ChevronRight, 2.4);
export const PracticeIcon = icon(RefreshCw);
export const BlitzIcon = icon(Zap);
export const PhishIcon = icon(FishingHook);
export const LockIcon = icon(Lock);
export const ClockIcon = icon(Clock);
export const BookIcon = icon(BookOpen);
export const LinkIcon = icon(Link);
export const ClipIcon = icon(Paperclip);
export const PlayIcon = icon(Play);
export const ShieldIcon = icon(ShieldCheck);
export const WarnIcon = icon(TriangleAlert);
export const TapIcon = icon(Pointer);
export const GlobeIcon = icon(Globe);
export const PhoneIcon = icon(Phone);
export const TextIcon = icon(MessageSquare);

/* Chevron that turns to point up when its section is open */
export function ChevronIcon({ open }: { open: boolean }) {
  return <ChevronDown aria-hidden="true" focusable="false" strokeWidth={2.4} className={'chev' + (open ? ' open' : '')} />;
}

/* 10 squares, echoing the app icon */
export function DailyIcon() {
  const cells = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 5; c++) {
      const i = r * 5 + c;
      cells.push(
        <rect key={i} x={1 + c * 6} y={6 + r * 6} width={4.6} height={4.6} rx={1}
          fill="currentColor" opacity={i < 7 ? 1 : 0.3} />
      );
    }
  }
  return <svg viewBox="0 0 30 24" aria-hidden="true">{cells}</svg>;
}
