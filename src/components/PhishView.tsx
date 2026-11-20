import { Fragment, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  hostOf, POINTS, TIERS, verdictFor,
  type DirectoryEntry, type PhishCard, type PhishResult, type Tier, type Verdict
} from '../lib/phish.ts';
import { haptic } from '../lib/haptics.ts';
import Sheet from './Sheet.tsx';
import { XpNote } from './BlitzView.tsx';
import { xpRateText } from '../lib/progress.ts';
import {
  ArchiveIcon, ArrowIcon, ArrowLeftIcon, BackIcon, BookIcon, CameraIcon, ChevronIcon, ComposeIcon, CrossIcon, FileIcon,
  FolderIcon, GlobeIcon, InfoIcon, LinkIcon, LockIcon, MicIcon, PhoneIcon, PlayIcon, PlusIcon, ReloadIcon,
  ReplyIcon, SendIcon, ShieldIcon, SpeakerIcon, TapIcon, TextIcon, TickIcon, UpIcon, WarnIcon
} from './icons.tsx';

const SwipeLeftIcon = ArrowLeftIcon;
const SwipeRightIcon = ArrowIcon;
const HoldIcon = LinkIcon;

/* ---------- before a round ---------- */

interface IntroProps {
  level: number;
  tier: Tier;
  onTier: (t: Tier) => void;
  best: number;
  roundsToday: number;
  onDirectory: () => void;
}

export function PhishIntro({ level, tier, onTier, best, roundsToday, onDirectory }: IntroProps) {
  const rules = [
    { tone: 'bad', icon: <SwipeLeftIcon />, value: 'Phish', label: 'Swipe left, or tap Phish' },
    { tone: 'good', icon: <SwipeRightIcon />, value: 'Legit', label: 'Swipe right, or tap Legit' },
    { tone: 'tap', icon: <TapIcon />, value: 'Tap', label: 'a sender or address to see it in full' },
    { tone: 'hold', icon: <HoldIcon />, value: 'Hold', label: 'a link to see where it really goes' }
  ];
  return (
    <div className="blitz-intro">
      <h2 className="done-title">Phish or legit?</h2>
      <p className="done-sub">Ten messages. Check the details against the Directory, then make the call.</p>
      <div className="rule-grid">
        {rules.map((r) => (
          <div key={r.tone} className={'rule rule-' + r.tone}>
            <span className="rule-icon">{r.icon}</span>
            <span className="rule-value">{r.value}</span>
            <span className="rule-label">{r.label}</span>
          </div>
        ))}
      </div>

      <button type="button" className="ph-dir-btn" onClick={() => { haptic(); onDirectory(); }}>
        <BookIcon />
        <span><b>Directory</b><span>Genuine domains and numbers for every organisation</span></span>
        <SwipeRightIcon />
      </button>

      <p className="section-label">Level</p>
      <div className="ph-levels" role="radiogroup" aria-label="Level">
        {TIERS.map((t) => {
          const locked = level < t.unlock;
          const on = t.tier === tier;
          return (
            <button
              key={t.tier}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={locked}
              className={'ph-level' + (on ? ' on' : '') + (locked ? ' locked' : '')}
              onClick={() => { haptic(); onTier(t.tier); }}
            >
              <span className="ph-level-text">
                <b>{t.name}</b>
                <span>{locked ? `Unlocks at level ${t.unlock}` : t.desc}</span>
              </span>
              <span className="ph-level-mark">{locked ? <LockIcon /> : on ? <TickIcon /> : null}</span>
            </button>
          );
        })}
      </div>

      <p className="blitz-foot">
        <span>Best <b>{best || '–'}</b></span>
        <XpNote roundsToday={roundsToday} />
      </p>
    </div>
  );
}

/* ---------- one message, drawn like the real app on a phone ---------- */

// stable made-up details per card (time, file size, waveform), so a card always looks the same
function seed(s: string): number {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}
const clockFor = (id: string) => {
  const h = seed(id);
  return `${String(7 + (h % 12)).padStart(2, '0')}:${String((h >>> 4) % 60).padStart(2, '0')}`;
};
const sizeFor = (id: string) => `${48 + (seed(id) % 420)} KB`;
const waveFor = (id: string) => Array.from({ length: 34 }, (_, i) => 22 + (seed(id + i) % 78));
const AVATAR = ['#5b7fa6', '#7a6aa8', '#4f8f7a', '#b0754a', '#a85b6a', '#5f7287'];
const avatarBg = (name: string) => AVATAR[seed(name) % AVATAR.length];
const initials = (name: string) =>
  name.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '#';
const longDate = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

interface MsgProps {
  card: PhishCard;
  review: boolean;                       // after answering: everything revealed, signs highlighted
  open: boolean;                         // sender / address details expanded
  onToggle: () => void;
  onPressLink?: (url: string, el: HTMLElement) => void;
  onReleaseLink?: () => void;
  onTapLink?: () => void;
  cardStyle?: CSSProperties;             // the swipe transform (only the card moves, not the context line)
  overlay?: ReactNode;                   // the Phish / Legit stamps
}

function Pin({ n, kind }: { n: number; kind: string }) {
  return <i className={'pin ' + kind} aria-label={`sign ${n}`}>{n}</i>;
}

function Message({ card, review, open, onToggle, onPressLink, onReleaseLink, onTapLink, cardStyle, overlay }: MsgProps) {
  const kind = card.phish ? 'flag' : 'ok';
  const pts = card.points.map((p, i) => ({ ...p, n: i + 1 }));
  const quotes = review ? pts.filter((p) => p.quote).map((p) => ({ q: p.quote!, n: p.n })) : [];
  const used = new Set<number>(); // each phrase is highlighted once, at its first appearance
  const clock = clockFor(card.id);
  const showDetails = open || review;

  const pins = (at: string) => review
    ? pts.filter((p) => p.at === at).map((p) => <Pin key={p.n} n={p.n} kind={kind} />)
    : null;
  const mark = (at: string) => (review && pts.some((p) => p.at === at) ? ' hl ' + kind : '');

  const hl = (text: string): ReactNode => {
    let first: { i: number; q: string; n: number } | null = null;
    for (const x of quotes) {
      if (used.has(x.n)) continue;
      const i = text.indexOf(x.q);
      if (i >= 0 && (!first || i < first.i)) first = { i, ...x };
    }
    if (!first) return text;
    used.add(first.n);
    return (
      <>
        {text.slice(0, first.i)}
        <mark className={'hl ' + kind}>{first.q}<Pin n={first.n} kind={kind} /></mark>
        {hl(text.slice(first.i + first.q.length))}
      </>
    );
  };

  const link = (idx: number) => {
    const l = card.links?.[idx];
    if (!l) return null;
    if (review) {
      return (
        <span className={'msg-link-wrap' + mark('link' + idx)}>
          <span className="msg-link">{l.text}</span>{pins('link' + idx)}
          <span className="link-real">{l.url}</span>
        </span>
      );
    }
    return (
      <span
        className="msg-link"
        role="link"
        tabIndex={0}
        aria-label={`${l.text}. Press and hold to see where it goes.`}
        onPointerDown={(e) => onPressLink?.(l.url, e.currentTarget)}
        onPointerUp={() => onReleaseLink?.()}
        onPointerLeave={() => onReleaseLink?.()}
        onClick={(e) => { e.stopPropagation(); onTapLink?.(); }}
        onContextMenu={(e) => e.preventDefault()}
      >{l.text}</span>
    );
  };

  const body = (paras: string[] | undefined, cls: string) => paras?.map((p, k) => (
    <p key={k} className={cls}>
      {p.split(/(\[\[\d+\]\])/).map((seg, j) => {
        const m = seg.match(/^\[\[(\d+)\]\]$/);
        return <Fragment key={j}>{m ? link(Number(m[1])) : hl(seg)}</Fragment>;
      })}
    </p>
  ));

  let inner: ReactNode = null;
  switch (card.type) {
    /* mail app: reading one email */
    case 'email': {
      const f = card.from!;
      inner = (
        <div className="mock mail">
          <div className="mk-bar" aria-hidden="true">
            <span className="mk-back"><BackIcon />Inbox</span>
            <span className="mk-tools"><UpIcon /><span className="down"><UpIcon /></span></span>
          </div>
          <div className="ml-head">
            <span className="avatar" style={{ background: avatarBg(f.name) }} aria-hidden="true">{initials(f.name)}</span>
            <div className="ml-from">
              <div className="ml-row">
                <button type="button" className="ml-name" onClick={onToggle} aria-expanded={showDetails} disabled={review}>{f.name}</button>
                <span className="ml-time">{clock}</span>
              </div>
              {showDetails ? (
                <div className="ml-details">
                  <span>From: <span className={'addr' + mark('from')}>{f.address}{pins('from')}</span></span>
                  {card.replyTo && <span>Reply-To: <span className={'addr' + mark('replyTo')}>{card.replyTo}{pins('replyTo')}</span></span>}
                  <span>To: Sam</span>
                </div>
              ) : (
                <button type="button" className="ml-to" onClick={onToggle}>To: Sam<ChevronIcon open={false} /></button>
              )}
            </div>
          </div>
          {card.subject && <p className="ml-subject">{hl(card.subject)}{pins('subject')}</p>}
          {card.external && (
            <p className={'ml-external' + mark('external')}>
              <WarnIcon /><span>External sender. Take care with links and attachments.</span>{pins('external')}
            </p>
          )}
          <div className="ml-body">{body(card.body, 'ml-p')}</div>
          {card.attachment && (
            <div className={'ml-attach' + mark('attachment')}>
              <span className="ml-file"><FileIcon /></span>
              <span className="ml-file-text"><b>{card.attachment}</b><span>{sizeFor(card.id)}</span></span>
              {pins('attachment')}
            </div>
          )}
          <div className="mk-toolbar" aria-hidden="true"><ArchiveIcon /><FolderIcon /><ReplyIcon /><ComposeIcon /></div>
        </div>
      );
      break;
    }
    /* messages app: one text in a thread */
    case 'sms': {
      const name = card.from!.name;
      const number = !/^[A-Za-z]/.test(name);
      inner = (
        <div className="mock sms">
          <div className="sm-top">
            <span className="mk-icon" aria-hidden="true"><BackIcon /></span>
            <div className="sm-contact">
              <span className="avatar lg" style={{ background: number ? '#8e929a' : avatarBg(name) }} aria-hidden="true">
                {number ? '#' : initials(name)}
              </span>
              <span className={'sm-name' + mark('from')}>{name}{pins('from')}</span>
            </div>
            <span className="mk-icon" aria-hidden="true" />
          </div>
          <p className="sm-stamp">Text Message · Today {clock}</p>
          {body(card.body, 'sm-bubble')}
          <div className="sm-compose" aria-hidden="true">
            <span className="sm-cam"><CameraIcon /></span><span className="sm-field">Text Message</span><MicIcon />
          </div>
        </div>
      );
      break;
    }
    /* workplace chat */
    case 'chat': {
      const f = card.from!;
      inner = (
        <div className="mock chat">
          <div className="ct-bar">
            <b>{card.orgShort ?? 'Work'} Chat</b>
            <span>{card.external ? 'External chat' : 'Direct message'}</span>
          </div>
          {card.external && (
            <p className={'ct-banner' + mark('external')}>
              <WarnIcon /><span>This person is outside your organisation.</span>{pins('external')}
            </p>
          )}
          <div className="ct-msg">
            <span className="avatar sq" style={{ background: avatarBg(f.name) }} aria-hidden="true">{initials(f.name)}</span>
            <div className="ct-main">
              <div className="ct-who">
                <button type="button" className="ct-name" onClick={onToggle} aria-expanded={showDetails} disabled={review}>{f.name}</button>
                <span className="ct-time">{clock}</span>
              </div>
              {showDetails && <span className={'ct-addr addr' + mark('from')}>{f.address}{pins('from')}</span>}
              {body(card.body, 'ct-text')}
            </div>
          </div>
          <div className="ct-compose" aria-hidden="true">
            <PlusIcon /><span>Message {f.name.split(/[\s·(]/)[0]}</span><SendIcon />
          </div>
        </div>
      );
      break;
    }
    /* phone app: a voicemail with its transcript */
    case 'voicemail':
      inner = (
        <div className="mock vm">
          <div className="mk-bar" aria-hidden="true">
            <span className="mk-back"><BackIcon />Phone</span><b>Voicemail</b><span className="mk-spacer" />
          </div>
          <div className="vm-caller">
            <span className={'vm-from' + mark('from')}>{card.from!.name}{pins('from')}</span>
            <span className="vm-date">Today at {clock}</span>
          </div>
          <div className="vm-player" aria-hidden="true">
            <span className="vm-play"><PlayIcon /></span>
            <span className="vm-wave">{waveFor(card.id).map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</span>
            <span className="vm-dur">{card.time ?? '0:30'}</span>
          </div>
          <div className="vm-actions" aria-hidden="true">
            <span><SpeakerIcon />Speaker</span><span><PhoneIcon />Call back</span><span><InfoIcon />Details</span>
          </div>
          <p className="vm-label">Transcript</p>
          {body(card.body, 'vm-text')}
        </div>
      );
      break;
    /* lock screen with a sign-in notification */
    case 'mfa': {
      const m = card.mfa!;
      const numbered = /number/i.test(m.title);
      inner = (
        <div className="mock lock">
          <p className="lk-date">{longDate()}</p>
          <p className="lk-time">{clock}</p>
          <div className={'lk-notif' + mark('prompt')}>
            <div className="lk-app">
              <span className="lk-icon"><ShieldIcon /></span><span className="lk-name">{m.app}</span><span className="lk-now">now</span>
            </div>
            <p className="lk-title">{m.title}{pins('prompt')}</p>
            <ul className="lk-lines">{m.lines.map((l) => <li key={l}>{hl(l)}</li>)}</ul>
            {numbered && <div className="lk-code" aria-hidden="true"><span /><span /></div>}
            <div className="lk-actions" aria-hidden="true"><span>Deny</span><span>{numbered ? 'Submit' : 'Approve'}</span></div>
          </div>
        </div>
      );
      break;
    }
    /* browser: a sign-in page or an app asking for permissions */
    case 'login':
    case 'consent': {
      const url = card.url!;
      const c = card.consent;
      const brand = c ? (card.org ?? 'Sign in') : (card.page?.brand ?? '');
      inner = (
        <div className="mock browser">
          <div className="br-bar">
            <button type="button" className={'br-addr' + mark('url')} onClick={onToggle} disabled={review}
              aria-label={showDetails ? url : `${hostOf(url)}. Tap to see the full address.`}>
              <span className="br-aa" aria-hidden="true">aA</span>
              <span className="br-url"><LockIcon />{showDetails ? url : hostOf(url)}</span>
              <ReloadIcon />{pins('url')}
            </button>
          </div>
          <div className="pg">
            <div className="pg-brand"><span className="pg-logo" aria-hidden="true">{brand[0]}</span><b>{brand}</b></div>
            {c ? (
              <>
                <p className="pg-heading">Permissions requested</p>
                <div className={'cs-app' + mark('publisher')}>
                  <span className="cs-icon" style={{ background: avatarBg(c.app) }} aria-hidden="true">{c.app[0]}</span>
                  <span className="cs-text">
                    <b>{c.app}</b>
                    <span className={'cs-pub' + (c.verified ? ' verified' : '')}>{c.verified ? <TickIcon /> : <WarnIcon />}{c.publisher}</span>
                  </span>
                  {pins('publisher')}
                </div>
                <p className="cs-lead">This app would like to:</p>
                <ul className={'scopes' + mark('scopes')}>{c.scopes.map((s) => <li key={s}>{s}</li>)}{pins('scopes')}</ul>
                <div className="page-actions" aria-hidden="true"><span>Cancel</span><span className="primary">Accept</span></div>
              </>
            ) : (
              <>
                <p className="pg-heading">{card.page?.heading}</p>
                <span className="field" aria-hidden="true">Email address</span>
                <span className="field" aria-hidden="true">Password</span>
                <span className="pg-btn" aria-hidden="true">Sign in</span>
                <span className="pg-link" aria-hidden="true">Forgot your password?</span>
              </>
            )}
          </div>
        </div>
      );
      break;
    }
    /* a shared link, shown as a link preview */
    case 'link': {
      const url = card.url!;
      inner = (
        <div className={'mock linkprev' + mark('url')}>
          <div className="lp-thumb" aria-hidden="true"><GlobeIcon /></div>
          <div className="lp-meta">
            <b className="lp-host">{hostOf(url)}</b>
            <span className="lp-url">{url}{pins('url')}</span>
          </div>
        </div>
      );
      break;
    }
  }

  return (
    <>
      {card.context && <p className="ph-context">{hl(card.context)}</p>}
      <div className={'ph-card' + (review ? ' review' : '')} style={cardStyle}>{overlay}{inner}</div>
    </>
  );
}

/* ---------- a card explained: verdict, the annotated message, and the notes ---------- */

const VERDICT: Record<Verdict, { title: string; sub: string; good: boolean }> = {
  caught: { title: 'Caught it', sub: 'It was a phish.', good: true },
  trusted: { title: 'Right, it’s genuine', sub: 'Nothing to worry about.', good: true },
  fooled: { title: 'Fooled', sub: 'That was a phish.', good: false },
  'false-alarm': { title: 'False alarm', sub: 'That one was genuine.', good: false }
};

function Explained({ card, v }: { card: PhishCard; v: Verdict }) {
  const kind = card.phish ? 'flag' : 'ok';
  return (
    <>
      <div className={'ph-verdict ' + (VERDICT[v].good ? 'good' : 'bad')}>
        <span className="v-icon">{VERDICT[v].good ? <TickIcon /> : <CrossIcon />}</span>
        <span><b>{VERDICT[v].title}</b><span>{VERDICT[v].sub}</span></span>
      </div>
      <Message card={card} review open onToggle={() => {}} />
      <p className="section-label">{card.phish ? 'Warning signs' : 'Why it’s safe'}</p>
      <ol className="ph-points">
        {card.points.map((p, i) => <li key={i}><Pin n={i + 1} kind={kind} /><span>{p.note}</span></li>)}
      </ol>
    </>
  );
}

/* ---------- the round ---------- */

const SWIPE = 90;      // px to count as a decision
const EDGE = 28;       // touches starting this close to the left edge are the "back" swipe
const HOLD_MS = 420;   // press and hold a link this long to preview it
const FLY_MS = 300;    // the card flies off the screen this fast
const SHOW_RIGHT = 1100; // how long the verdict shows before the next card (right answer)
const SHOW_WRONG = 1900; // a little longer after a mistake, so there's time to tap Why?

interface GameProps {
  cards: PhishCard[];
  tier: Tier;
  onAnswer: (card: PhishCard, saidPhish: boolean) => void;
  onEnd: (r: PhishResult) => void;
  onDirectory: () => void;
}

/* Swipe, see a quick verdict, and the next card comes in by itself. Tap Why? for the full
   explanation; every mistake is explained in full on the results screen anyway. */
export function PhishGame({ cards, tier, onAnswer, onEnd, onDirectory }: GameProps) {
  const [index, setIndex] = useState(0);
  const [said, setSaid] = useState<boolean | null>(null);
  const [stage, setStage] = useState<'card' | 'verdict' | 'review'>('card');
  const [fly, setFly] = useState<0 | 1 | -1>(0); // the card leaving: -1 left (Phish), 1 right (Legit)
  const [open, setOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [peek, setPeek] = useState<{ url: string; top: number; below: boolean } | null>(null);
  const [hint, setHint] = useState(0);
  const verdicts = useRef<{ id: string; v: Verdict }[]>([]);
  const decided = useRef(false);
  const drag = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const swallowClick = useRef(false);
  const press = useRef(0);
  const pressed = useRef(false);
  const timers = useRef<number[]>([]);
  const auto = useRef(0);

  const card = cards[index];
  const last = index === cards.length - 1;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    window.clearTimeout(press.current);
    window.clearTimeout(auto.current);
  }, []);

  // a link preview closes on the next touch anywhere
  useEffect(() => {
    if (!peek) return;
    const close = () => setPeek(null);
    const t = window.setTimeout(() => window.addEventListener('pointerdown', close, { once: true }), 0);
    return () => { window.clearTimeout(t); window.removeEventListener('pointerdown', close); };
  }, [peek]);

  const finish = () => {
    const score = verdicts.current.reduce((s, x) => s + POINTS[x.v], 0);
    onEnd({ tier, score, verdicts: verdicts.current });
  };

  const next = () => {
    window.clearTimeout(auto.current);
    if (last) { finish(); return; }
    decided.current = false;
    setIndex((i) => i + 1);
    setSaid(null);
    setStage('card');
    setOpen(false);
    window.scrollTo(0, 0);
  };

  const why = () => {
    window.clearTimeout(auto.current);
    haptic();
    setStage('review');
    window.scrollTo(0, 0);
  };

  const decide = (saidPhish: boolean) => {
    if (decided.current) return;
    decided.current = true;
    const v = verdictFor(card, saidPhish);
    const good = v === 'caught' || v === 'trusted';
    haptic(good ? 'success' : 'error');
    verdicts.current.push({ id: card.id, v });
    onAnswer(card, saidPhish);
    setPeek(null);
    setDragging(false);
    setSaid(saidPhish);
    const flight = still ? 0 : FLY_MS;
    if (still) { setDx(0); setStage('verdict'); }
    else {
      // the card carries on in the direction you chose, right off the screen
      setFly(saidPhish ? -1 : 1);
      timers.current.push(window.setTimeout(() => { setFly(0); setDx(0); setStage('verdict'); }, flight));
    }
    // then the next card comes in by itself, unless Why? is tapped
    auto.current = window.setTimeout(next, flight + (good ? SHOW_RIGHT : SHOW_WRONG));
  };

  /* swipe: the card follows your finger sideways; vertical moves scroll the page as normal */
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (said !== null || e.clientX <= EDGE) return;
    drag.current = { x: e.clientX, y: e.clientY, active: false };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x, my = e.clientY - d.y;
    if (!d.active) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.2) {
        d.active = true;
        releaseLink();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
      } else if (Math.abs(my) > 10) {
        drag.current = null; // it's a scroll
        releaseLink();
        return;
      } else return;
    }
    setDx(mx);
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    swallowClick.current = true;
    const mx = e.clientX - d.x;
    if (mx <= -SWIPE) decide(true);
    else if (mx >= SWIPE) decide(false);
    else { setDragging(false); setDx(0); }
  };

  /* press and hold a link to preview where it goes */
  const pressLink = (url: string, el: HTMLElement) => {
    pressed.current = false;
    window.clearTimeout(press.current);
    press.current = window.setTimeout(() => {
      pressed.current = true;
      const r = el.getBoundingClientRect();
      const below = r.top < 150;
      setPeek({ url, top: below ? r.bottom + 10 : r.top - 10, below });
      haptic();
    }, HOLD_MS);
  };
  function releaseLink() { window.clearTimeout(press.current); }
  const tapLink = () => {
    if (pressed.current) { pressed.current = false; return; }
    setHint((h) => h + 1);
  };
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(0), 2200);
    return () => window.clearTimeout(t);
  }, [hint]);

  const v = said !== null ? verdictFor(card, said) : null;
  const good = v === 'caught' || v === 'trusted';
  const lean = dx < 0 ? 'phish' : dx > 0 ? 'legit' : '';
  const strength = Math.min(1, Math.abs(dx) / SWIPE);
  const showCard = stage === 'card';

  return (
    <div className="phish">
      <div className="ph-meta">
        <span className="ph-count">Card <b>{index + 1}</b> of {cards.length}</span>
        <span className="ph-dots" aria-hidden="true">
          {cards.map((c, i) => {
            const r = verdicts.current[i]?.v;
            return <i key={c.id} className={r ? (r === 'caught' || r === 'trusted' ? 'good' : 'bad') : i === index ? 'now' : ''} />;
          })}
        </span>
        <button type="button" className="ph-dir-chip" onClick={() => { haptic(); onDirectory(); }}><BookIcon />Directory</button>
      </div>

      <div key={card.id + stage} className={'ph-stage' + (stage === 'review' ? ' flip-in' : stage === 'card' && index > 0 ? ' slide-in' : '')}>
        {stage === 'review' && v ? (
          <Explained card={card} v={v} />
        ) : stage === 'verdict' && v ? (
          <div className={'ph-flash ' + (good ? 'good' : 'bad')} role="status">
            <span className="flash-icon">{good ? <TickIcon /> : <CrossIcon />}</span>
            <b>{VERDICT[v].title}</b>
            <span>{VERDICT[v].sub}</span>
          </div>
        ) : showCard ? (
          <div
            className={'ph-swipe' + (dragging ? ' dragging' : '') + (fly ? ' flying' : '') + (lean || fly ? ' lean-' + (fly ? (fly < 0 ? 'phish' : 'legit') : lean) : '')}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => { drag.current = null; setDragging(false); setDx(0); releaseLink(); }}
            onClickCapture={(e) => { if (swallowClick.current) { swallowClick.current = false; e.stopPropagation(); e.preventDefault(); } }}
          >
            <Message
              card={card}
              review={false}
              open={open}
              onToggle={() => { haptic(); setOpen((o) => !o); }}
              onPressLink={pressLink}
              onReleaseLink={releaseLink}
              onTapLink={tapLink}
              cardStyle={fly
                ? { transform: `translateX(${fly * (window.innerWidth + 120)}px) rotate(${fly * 18}deg)` }
                : dx ? { transform: `translateX(${dx}px) rotate(${dx / 22}deg)` } : undefined}
              overlay={<>
                <span className="stamp stamp-phish" style={{ opacity: fly < 0 ? 1 : dx < 0 ? strength : 0 }} aria-hidden="true">Phish</span>
                <span className="stamp stamp-legit" style={{ opacity: fly > 0 ? 1 : dx > 0 ? strength : 0 }} aria-hidden="true">Legit</span>
              </>}
            />
          </div>
        ) : null}
      </div>

      {hint > 0 && showCard && <p className="ph-hint" role="status">Press and hold a link to see where it goes.</p>}

      {peek && createPortal(
        <div className={'link-peek' + (peek.below ? ' below' : '')} style={{ top: peek.top }} role="tooltip">
          <span className="peek-label">This link goes to</span>
          <span className="peek-url">{peek.url}</span>
        </div>,
        document.body
      )}

      {createPortal(
        <div className="actionbar floating">
          <div className="actionbar-inner">
            {stage === 'review' ? (
              <button type="button" className="btn" onClick={() => { haptic(); next(); }}>
                {last ? 'See results' : 'Next card'}<ArrowIcon />
              </button>
            ) : stage === 'verdict' ? (
              <div className="bar-pair">
                <button type="button" className="btn secondary" onClick={why}>Why?</button>
                <button type="button" className="btn" onClick={() => { haptic(); next(); }}>{last ? 'See results' : 'Next'}<ArrowIcon /></button>
              </div>
            ) : (
              <div className="ph-choice">
                <button type="button" className="btn ph-btn phish" onClick={() => decide(true)}><WarnIcon />Phish</button>
                <button type="button" className="btn ph-btn legit" onClick={() => decide(false)}><TickIcon />Legit</button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

/* ---------- after a round: the score, then every mistake explained in full ---------- */

interface DoneProps {
  result: PhishResult;
  prevBest: number;
  best: number;
  xp: number;
  rate: number;
  byId: Map<string, PhishCard>;
}

export function PhishDone({ result, prevBest, best, xp, rate, byId }: DoneProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const count = (v: Verdict) => result.verdicts.filter((x) => x.v === v).length;
  const phishTotal = result.verdicts.filter((x) => byId.get(x.id)?.phish).length;
  const newBest = result.score > prevBest && result.score > 0;
  const mistakes = result.verdicts.filter((x) => x.v === 'fooled' || x.v === 'false-alarm');
  const rights = result.verdicts.filter((x) => x.v === 'caught' || x.v === 'trusted');
  const tierName = TIERS.find((t) => t.tier === result.tier)?.name ?? '';

  return (
    <>
      <h2 className="done-title">{mistakes.length === 0 ? 'Nothing got past you.' : newBest ? 'New best.' : 'Round done.'}</h2>
      <p className="done-sub">
        <b>{result.score} out of 100</b> at {tierName}.{' '}
        {newBest ? (prevBest > 0 ? `Up from ${prevBest}.` : 'That’s the score to beat.') : `Your best is ${best}.`}
      </p>

      <section className="stat-row">
        <div className="stat">
          <span className="stat-value">{count('caught')}/{phishTotal}</span>
          <span className="stat-label">Phish caught</span>
        </div>
        <div className="stat">
          <span className="stat-value">{count('fooled')}</span>
          <span className="stat-label">Let through</span>
        </div>
        <div className="stat">
          <span className="stat-value">{count('false-alarm')}</span>
          <span className="stat-label">False alarms</span>
        </div>
      </section>
      <p className="p-note">+{xp} XP{rate < 1 && ` (${xpRateText(rate)}: you’ve played a lot today)`}</p>

      {mistakes.length > 0 ? (
        <>
          <p className="section-label">{mistakes.length === 1 ? 'Your mistake' : `Your ${mistakes.length} mistakes`}</p>
          {mistakes.map(({ id, v }) => {
            const c = byId.get(id);
            return c ? <div key={id} className="ph-review"><Explained card={c} v={v} /></div> : null;
          })}
        </>
      ) : (
        <p className="p-note">Every phish caught and every genuine message trusted.</p>
      )}

      {rights.length > 0 && (
        <>
          <p className="section-label">Got right ({rights.length})</p>
          <ul className="ph-rights">
            {rights.map(({ id, v }) => {
              const c = byId.get(id);
              if (!c) return null;
              const isOpen = openId === id;
              return (
                <li key={id}>
                  <button type="button" className="ph-right-row" aria-expanded={isOpen}
                    onClick={() => { haptic(); setOpenId(isOpen ? null : id); }}>
                    <TickIcon /><span>{c.lesson}</span><ChevronIcon open={isOpen} />
                  </button>
                  {isOpen && <div className="ph-review"><Explained card={c} v={v} /></div>}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

/* ---------- the Directory: just the genuine details, one small card per organisation ---------- */

const DIR_ICON = { web: <GlobeIcon />, phone: <PhoneIcon />, text: <TextIcon /> };

// long domains wrap after a dot, never mid-word
const breakable = (s: string) => s.split('.').map((part, i) => <Fragment key={i}>{i > 0 && <>.<wbr /></>}{part}</Fragment>);

export function DirectorySheet({ directory, onClose }: { directory: DirectoryEntry[]; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} labelledBy="dir-title" scroll>
      {(close) => (
        <div className="dir">
          <h2 className="sheet-title" id="dir-title">Directory</h2>
          <p className="sheet-small">The real details. Anything else isn’t them.</p>
          {directory.map((d) => (
            <section key={d.org} className="dir-card">
              <p className="dir-name"><b>{d.org}</b><span>{d.role}</span></p>
              <ul className="dir-chips">
                {d.rows.map((r) => (
                  <li key={r.value}>
                    {DIR_ICON[r.icon]}
                    <b>{breakable(r.value)}</b>{r.label && <span>{r.label}</span>}
                  </li>
                ))}
              </ul>
              <ul className="dir-rules">
                {d.rules.map((r) => <li key={r}><ShieldIcon />{r}</li>)}
              </ul>
            </section>
          ))}
          <button type="button" className="btn" onClick={() => close()}>Done</button>
        </div>
      )}
    </Sheet>
  );
}
