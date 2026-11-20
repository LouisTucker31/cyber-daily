/* Interface icons. Most come from Lucide (lucide.dev, ISC licence) so they're consistent and crisp;
   the badge medals and their glyphs are drawn separately in Badge.tsx. */
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Fish, House,
  Globe, Link, Lock, MessageSquare, Paperclip, Phone, Play, Pointer, RefreshCw, ShieldCheck, TriangleAlert, X, Zap,
  Archive, Camera, ChevronUp, FileText, Folder, Info, Mic, Plus, Reply, RotateCw, Send, SquarePen, Volume2,
  Activity, ClipboardList, MessagesSquare, Siren, Timer,
  type LucideIcon
} from 'lucide-react';

const icon = (I: LucideIcon, strokeWidth = 1.75) => // a touch lighter than Lucide's default 2
  function Icon({ className }: { className?: string }) {
    return <I aria-hidden="true" focusable="false" strokeWidth={strokeWidth} className={className} />;
  };

export const TickIcon = icon(Check, 2.1);
export const CrossIcon = icon(X, 2.1);
export const ArrowIcon = icon(ArrowRight);
export const ArrowLeftIcon = icon(ArrowLeft);
export const BackIcon = icon(ChevronLeft, 2.1);
export const ChevronRightIcon = icon(ChevronRight, 2.1);
export const PracticeIcon = icon(RefreshCw);
export const BlitzIcon = icon(Zap);
export const PhishIcon = icon(Fish);
export const HomeIcon = icon(House);
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
// phone-style mock-ups in Spot the Phish
export const ArchiveIcon = icon(Archive);
export const CameraIcon = icon(Camera);
export const UpIcon = icon(ChevronUp, 2.1);
export const FileIcon = icon(FileText);
export const FolderIcon = icon(Folder);
export const InfoIcon = icon(Info);
export const MicIcon = icon(Mic);
export const PlusIcon = icon(Plus);
export const ReplyIcon = icon(Reply);
export const ReloadIcon = icon(RotateCw);
export const SendIcon = icon(Send);
export const ComposeIcon = icon(SquarePen);
export const SpeakerIcon = icon(Volume2);
// Incident Commander
export const IncidentIcon = icon(Siren);
export const GaugeIcon = icon(Activity);
export const ChatsIcon = icon(MessagesSquare);
export const ReportIcon = icon(ClipboardList);
export const TimerIcon = icon(Timer);

/* Chevron that turns to point up when its section is open */
export function ChevronIcon({ open }: { open: boolean }) {
  return <ChevronDown aria-hidden="true" focusable="false" strokeWidth={2.1} className={'chev' + (open ? ' open' : '')} />;
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
