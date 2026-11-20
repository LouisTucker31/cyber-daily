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
  ArrowIcon, ArrowLeftIcon, BookIcon, ChevronIcon, ClipIcon, CrossIcon, GlobeIcon, LinkIcon, LockIcon, PhishIcon,
  PhoneIcon, PlayIcon, ShieldIcon, TapIcon, TextIcon, TickIcon, WarnIcon
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

/* ---------- one message, drawn as the real thing ---------- */

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

  const initials = (name: string) => name.replace(/[^A-Za-z ]/g, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  const showDetails = open || review;

  let inner: ReactNode = null;
  switch (card.type) {
    case 'email': {
      const f = card.from!;
      inner = (
        <div className="ph-email">
          <div className="em-head">
            <span className="avatar" aria-hidden="true">{initials(f.name)}</span>
            <div className="em-from">
              <button type="button" className="em-name" onClick={onToggle} aria-expanded={showDetails} disabled={review}>
                <span>{f.name}</span>{!review && <ChevronIcon open={open} />}
              </button>
              {showDetails ? (
                <div className="em-details">
                  <span>From <span className={'addr' + mark('from')}>{f.address}{pins('from')}</span></span>
                  {card.replyTo && <span>Reply to <span className={'addr' + mark('replyTo')}>{card.replyTo}{pins('replyTo')}</span></span>}
                  <span>To <span className="addr">Sam</span></span>
                </div>
              ) : <span className="em-to">To: Sam</span>}
            </div>
          </div>
          {card.subject && <p className="em-subject">{hl(card.subject)}{pins('subject')}</p>}
          {card.external && (
            <p className={'em-external' + mark('external')}>
              <WarnIcon /><span>External sender. Take care with links and attachments.</span>{pins('external')}
            </p>
          )}
          <div className="em-body">{body(card.body, 'em-p')}</div>
          {card.attachment && (
            <span className={'em-attach' + mark('attachment')}><ClipIcon />{card.attachment}{pins('attachment')}</span>
          )}
        </div>
      );
      break;
    }
    case 'sms':
      inner = (
        <div className="ph-sms">
          <div className="sms-head">
            <span className="avatar" aria-hidden="true">{/^[A-Za-z]/.test(card.from!.name) ? initials(card.from!.name) : '#'}</span>
            <span className={'sms-from' + mark('from')}>{card.from!.name}{pins('from')}</span>
            <span className="sms-meta">Text message</span>
          </div>
          {body(card.body, 'bubble')}
        </div>
      );
      break;
    case 'chat': {
      const f = card.from!;
      inner = (
        <div className="ph-chat">
          <p className="chat-app">Kestrel Chat</p>
          <div className="chat-msg">
            <span className="avatar" aria-hidden="true">{initials(f.name)}</span>
            <div className="chat-main">
              <div className="chat-who">
                <button type="button" className="chat-name" onClick={onToggle} aria-expanded={showDetails} disabled={review}>{f.name}</button>
                {card.external && <span className={'tag-ext' + mark('external')}>External{pins('external')}</span>}
              </div>
              {showDetails && <span className={'chat-addr addr' + mark('from')}>{f.address}{pins('from')}</span>}
              {body(card.body, 'chat-text')}
            </div>
          </div>
        </div>
      );
      break;
    }
    case 'voicemail':
      inner = (
        <div className="ph-vm">
          <div className="vm-head">
            <span className="vm-icon"><PlayIcon /></span>
            <span className="vm-who">
              <span className={'vm-from' + mark('from')}>{card.from!.name}{pins('from')}</span>
              <span className="vm-meta">Voicemail{card.time ? ` · ${card.time}` : ''}</span>
            </span>
          </div>
          <p className="vm-label">Transcript</p>
          {body(card.body, 'vm-text')}
        </div>
      );
      break;
    case 'mfa': {
      const m = card.mfa!;
      const numbered = /number/i.test(m.title);
      inner = (
        <div className="ph-mfa">
          <p className="mfa-app"><ShieldIcon />{m.app}</p>
          <p className={'mfa-title' + mark('prompt')}>{m.title}{pins('prompt')}</p>
          <ul className="mfa-lines">{m.lines.map((l) => <li key={l}>{hl(l)}</li>)}</ul>
          <div className="mfa-actions" aria-hidden="true">
            <span>Deny</span>
            {numbered ? <span className="mfa-code">_ _</span> : <span className="primary">Approve</span>}
          </div>
        </div>
      );
      break;
    }
    case 'login':
    case 'consent': {
      const url = card.url!;
      const c = card.consent;
      inner = (
        <div className="ph-browser">
          <button type="button" className={'addr-bar' + mark('url')} onClick={onToggle} disabled={review}
            aria-label={showDetails ? url : `${hostOf(url)}. Tap to see the full address.`}>
            <LockIcon /><span>{showDetails ? url : hostOf(url)}</span>{pins('url')}
          </button>
          {c ? (
            <div className="page">
              <p className="page-brand">Kestrel Group</p>
              <p className="page-heading"><b>{c.app}</b> wants permission to:</p>
              <ul className={'scopes' + mark('scopes')}>{c.scopes.map((s) => <li key={s}>{s}</li>)}{pins('scopes')}</ul>
              <p className={'publisher' + (c.verified ? ' verified' : '') + mark('publisher')}>
                {c.verified ? <TickIcon /> : <WarnIcon />}<span>Publisher: {c.publisher}</span>{pins('publisher')}
              </p>
              <div className="page-actions" aria-hidden="true"><span>Cancel</span><span className="primary">Accept</span></div>
            </div>
          ) : (
            <div className="page">
              <p className="page-brand">{card.page?.brand}</p>
              <p className="page-heading">{card.page?.heading}</p>
              <span className="field" aria-hidden="true">Email address</span>
              <span className="field" aria-hidden="true">Password</span>
              <span className="page-actions single" aria-hidden="true"><span className="primary">Sign in</span></span>
            </div>
          )}
        </div>
      );
      break;
    }
    case 'link':
      inner = (
        <div className={'ph-linkcard' + mark('url')}>
          <span className="lc-icon"><LinkIcon /></span>
          <span className="lc-url">{card.url}{pins('url')}</span>
        </div>
      );
      break;
  }

  return (
    <>
      {card.context && <p className="ph-context">{hl(card.context)}</p>}
      <div className={'ph-card' + (review ? ' review' : '')} style={cardStyle}>{overlay}{inner}</div>
    </>
  );
}

/* ---------- the round ---------- */

const VERDICT: Record<Verdict, { title: string; sub: string; good: boolean }> = {
  caught: { title: 'Caught it', sub: 'This was a phish.', good: true },
  trusted: { title: 'Right, it’s genuine', sub: 'Nothing here to worry about.', good: true },
  fooled: { title: 'Fooled', sub: 'This was a phish.', good: false },
  'false-alarm': { title: 'False alarm', sub: 'This one was genuine.', good: false }
};

const SWIPE = 90;      // px to count as a decision
const EDGE = 28;       // touches starting this close to the left edge are the "back" swipe
const HOLD_MS = 420;   // press and hold a link this long to preview it
const FLY_MS = 300;    // the card flies off the screen this fast, then the explanation flips in

interface GameProps {
  cards: PhishCard[];
  tier: Tier;
  onAnswer: (card: PhishCard, saidPhish: boolean) => void;
  onEnd: (r: PhishResult) => void;
  onDirectory: () => void;
}

export function PhishGame({ cards, tier, onAnswer, onEnd, onDirectory }: GameProps) {
  const [index, setIndex] = useState(0);
  const [said, setSaid] = useState<boolean | null>(null);
  const [flip, setFlip] = useState<'none' | 'in'>('none');
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

  const card = cards[index];
  const answered = said !== null;
  const last = index === cards.length - 1;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => () => { timers.current.forEach((t) => window.clearTimeout(t)); window.clearTimeout(press.current); }, []);

  // a link preview closes on the next touch anywhere
  useEffect(() => {
    if (!peek) return;
    const close = () => setPeek(null);
    const t = window.setTimeout(() => window.addEventListener('pointerdown', close, { once: true }), 0);
    return () => { window.clearTimeout(t); window.removeEventListener('pointerdown', close); };
  }, [peek]);

  const decide = (saidPhish: boolean) => {
    if (decided.current) return;
    decided.current = true;
    const v = verdictFor(card, saidPhish);
    haptic(v === 'caught' || v === 'trusted' ? 'success' : 'error');
    verdicts.current.push({ id: card.id, v });
    onAnswer(card, saidPhish);
    setPeek(null);
    setDragging(false);
    if (still) { setDx(0); setSaid(saidPhish); return; }
    // the card carries on in the direction you chose, right off the screen
    setFly(saidPhish ? -1 : 1);
    timers.current.push(window.setTimeout(() => {
      setFly(0);
      setDx(0);
      setSaid(saidPhish);
      setFlip('in');
      window.scrollTo(0, 0);
    }, FLY_MS));
  };

  const next = () => {
    if (last) {
      const score = verdicts.current.reduce((s, x) => s + POINTS[x.v], 0);
      onEnd({ tier, score, verdicts: verdicts.current });
      return;
    }
    haptic();
    decided.current = false;
    setIndex((i) => i + 1);
    setSaid(null);
    setFlip('none');
    setOpen(false);
    window.scrollTo(0, 0);
  };

  /* swipe: the card follows your finger sideways; vertical moves scroll the page as normal */
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (answered || e.clientX <= EDGE) return;
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
  const kind = card.phish ? 'flag' : 'ok';
  const lean = dx < 0 ? 'phish' : dx > 0 ? 'legit' : '';
  const strength = Math.min(1, Math.abs(dx) / SWIPE);

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

      <div key={card.id + (answered ? '-r' : '')} className={'ph-stage' + (flip === 'in' ? ' flip-in' : '')}>
        {answered && v ? (
          <>
            <div className={'ph-verdict ' + (VERDICT[v].good ? 'good' : 'bad')}>
              <span className="v-icon">{VERDICT[v].good ? <TickIcon /> : <CrossIcon />}</span>
              <span><b>{VERDICT[v].title}</b><span>{VERDICT[v].sub}</span></span>
            </div>
            <Message card={card} review open onToggle={() => {}} />
            <p className="section-label">{card.phish ? 'Warning signs' : 'Why it’s safe'}</p>
            <ol className="ph-points">
              {card.points.map((p, i) => (
                <li key={i}><Pin n={i + 1} kind={kind} /><span>{p.note}</span></li>
              ))}
            </ol>
          </>
        ) : (
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
        )}
      </div>

      {hint > 0 && <p className="ph-hint" role="status">Press and hold a link to see where it goes.</p>}

      {peek && createPortal(
        <div className={'link-peek' + (peek.below ? ' below' : '')} style={{ top: peek.top }} role="tooltip">
          <span className="peek-label">This link goes to</span>
          <span className="peek-url">{peek.url}</span>
        </div>,
        document.body
      )}

      {createPortal(
        <div className="actionbar">
          <div className="actionbar-inner">
            {answered ? (
              <button type="button" className="btn" onClick={next}>
                {last ? 'See results' : 'Next card'}<ArrowIcon />
              </button>
            ) : (
              <div className="ph-choice">
                <button type="button" className="btn ph-btn phish" onClick={() => decide(true)}><PhishIcon />Phish</button>
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

/* ---------- after a round ---------- */

interface DoneProps {
  result: PhishResult;
  prevBest: number;
  best: number;
  xp: number;
  rate: number;
  byId: Map<string, PhishCard>;
}

const MISTAKE: Partial<Record<Verdict, string>> = { fooled: 'Let through', 'false-alarm': 'False alarm' };

export function PhishDone({ result, prevBest, best, xp, rate, byId }: DoneProps) {
  const count = (v: Verdict) => result.verdicts.filter((x) => x.v === v).length;
  const phishTotal = result.verdicts.filter((x) => byId.get(x.id)?.phish).length;
  const newBest = result.score > prevBest && result.score > 0;
  const mistakes = result.verdicts.filter((x) => x.v === 'fooled' || x.v === 'false-alarm');
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

      <p className="section-label">{mistakes.length ? 'To remember' : 'Every call right'}</p>
      {mistakes.length > 0 ? (
        <ul className="recap">
          {mistakes.map(({ id, v }) => {
            const c = byId.get(id);
            if (!c) return null;
            return (
              <li key={id} className="wrong">
                <span><CrossIcon /></span>
                <span><b className="recap-term">{MISTAKE[v]}</b> {c.lesson}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="p-note">Every phish caught and every genuine message trusted.</p>
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
