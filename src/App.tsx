import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  answer, completeDay, dateKey, daysUntil, drawPractice, dueIds, ensureToday, loadState, parseBank,
  practiceIds, recordResult, saveState,
  shownStreak, type PracticeSession, type Question, type State
} from './lib/quiz.ts';
import {
  acronymQuestion, finishBlitz, logBlitzAnswer, parseAcronyms, blitzRoundsToday, type Acronym, type BlitzResult
} from './lib/blitz.ts';
import Header from './components/Header.tsx';
import Home from './components/Home.tsx';
import QuestionView from './components/QuestionView.tsx';
import DoneView from './components/DoneView.tsx';
import Profile from './components/Profile.tsx';
import Celebration from './components/Celebration.tsx';
import { BlitzDone, BlitzGame, BlitzIntro } from './components/BlitzView.tsx';
import { DirectorySheet, PhishDone, PhishGame, PhishIntro } from './components/PhishView.tsx';
import { IncidentDebrief, IncidentGame, IncidentIntro } from './components/IncidentView.tsx';
import {
  finishIncident, incidentRoundsToday, logIncidentDecision, newRun, parseIncident,
  type IncidentBank, type IncidentResult, type Run
} from './lib/incident.ts';
import {
  applyCast, directoryFor, drawRound, finishPhish, logPhishAnswer, parsePhish, phishRoundsToday, pickCast, TIERS,
  type Cast, type PhishBank, type PhishCard, type PhishResult, type Tier
} from './lib/phish.ts';
import { evaluateProgress, levelInfo } from './lib/progress.ts';
import useCountdown from './hooks/useCountdown.ts';
import useEdgeSwipe from './hooks/useEdgeSwipe.ts';
import { haptic } from './lib/haptics.ts';
import { ArrowIcon, BackIcon, ClockIcon, HomeIcon } from './components/icons.tsx';

/* practiceBank = questions plus acronyms (as Practice questions), used only by Smart Practice */
type Load =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; bank: Question[]; acronyms: Acronym[]; practiceBank: Question[]; phish: PhishBank | null; incident: IncidentBank | null };
type View = 'home' | 'daily' | 'practice' | 'profile' | 'blitz' | 'phish' | 'incident';
type Incident =
  | { phase: 'intro' }
  | { phase: 'play'; round: number; run: Run }
  | { phase: 'done'; result: IncidentResult; prevBest: string | null; xp: number; rate: number };
type Motion = 'forward' | 'back' | 'none';
type Blitz =
  | { phase: 'intro' }
  | { phase: 'play'; round: number }
  | { phase: 'done'; result: BlitzResult; prevBest: number; xp: number; rate: number };
type Phish =
  | { phase: 'intro' }
  | { phase: 'play'; round: number; tier: Tier; cards: PhishCard[] }
  | { phase: 'done'; result: PhishResult; prevBest: number; xp: number; rate: number; cards: PhishCard[] };

export default function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [state, setState] = useState<State | null>(null);
  const stateRef = useRef<State | null>(null);
  const [view, setView] = useState<View>('home');
  const [practice, setPractice] = useState<PracticeSession | null>(null);
  const [motion, setMotion] = useState<Motion>('none');
  const [round, setRound] = useState(0); // bumps on each new screen so the slide animation replays
  const [blitz, setBlitz] = useState<Blitz>({ phase: 'intro' });
  const [phish, setPhish] = useState<Phish>({ phase: 'intro' });
  const [phishTier, setPhishTier] = useState<Tier | null>(null); // null = the highest unlocked
  const [showDirectory, setShowDirectory] = useState(false);
  const [incident, setIncident] = useState<Incident>({ phase: 'intro' });
  const [timed, setTimed] = useState(true); // Incident Commander countdowns (on by default)

  const bank = load.status === 'ready' ? load.bank : null;
  const acronyms = load.status === 'ready' ? load.acronyms : null;
  const practiceBank = load.status === 'ready' ? load.practiceBank : null;
  const bankRef = useRef<Question[]>([]);
  const practiceBankRef = useRef<Question[]>([]);
  const byId = useMemo(() => new Map((bank ?? []).map((q) => [q.id, q])), [bank]);
  const practiceById = useMemo(() => new Map((practiceBank ?? []).map((q) => [q.id, q])), [practiceBank]);
  const acronymById = useMemo(() => new Map((acronyms ?? []).map((a) => [a.id, a])), [acronyms]);
  const phishBank = load.status === 'ready' ? load.phish : null;
  const incidentBank = load.status === 'ready' ? load.incident : null;
  const [phishCast, setPhishCast] = useState<Cast | null>(null); // this round's fictional organisations

  /* Every change: copy, apply, save straight away, then re-render.
     Saving immediately means a refresh can never give a second chance. */
  const commit = useCallback((next: State) => {
    saveState(next);
    stateRef.current = next;
    setState(next);
  }, []);

  const update = useCallback((fn: (s: State) => void) => {
    const prev = stateRef.current;
    if (!prev) return;
    const next = structuredClone(prev);
    fn(next);
    evaluateProgress(next, bankRef.current, false, practiceBankRef.current); // XP level-ups, badges
    commit(next);
  }, [commit]);

  // load questions (required); acronyms and phish cards are optional (without them only that game is unavailable)
  useEffect(() => {
    const questions = fetch('questions.json', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
    const optional = (file: string, empty: unknown) => fetch(file, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : empty))
      .catch(() => empty);
    Promise.all([questions, optional('acronyms.json', []), optional('phish.json', null), optional('incident.json', null)])
      .then(([data, acr, ph, inc]) => {
        const b = parseBank(data);
        const a = parseAcronyms(acr);
        const pb = b.concat(a.map(acronymQuestion));
        const s = loadState();
        ensureToday(s, b);
        bankRef.current = b;
        practiceBankRef.current = pb;
        // first run with levels: count past progress quietly, then show one welcome sheet
        evaluateProgress(s, b, s.celebrations.some((c) => c.kind === 'welcome'), pb);
        commit(s);
        setLoad({ status: 'ready', bank: b, acronyms: a, practiceBank: pb, phish: parsePhish(ph), incident: parseIncident(inc) });
      })
      .catch(() => setLoad({ status: 'error' }));
  }, [commit]);

  const rollover = useCallback(() => {
    if (bank) update((s) => ensureToday(s, bank));
  }, [bank, update]);

  // new day when the app is reopened after midnight
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && state?.day && state.day.date !== dateKey()) rollover();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [state, rollover]);

  const day = state?.day ?? null;
  const dayDone = !!day && day.items.length > 0 && day.index >= day.items.length;
  const countdown = useCountdown(day?.date, rollover);

  // record the streak once the day's set is finished
  useEffect(() => {
    if (dayDone && day && !day.completed) update(completeDay);
  }, [dayDone, day, update]);

  /* Navigation. Opening a mode adds a history entry, so Android's back button
     (and the edge swipe) returns Home like a native app. */
  const skipMotion = useRef(false);

  // every screen change (including back to Home) starts at the top; the browser mustn't restore old scroll
  useEffect(() => { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; }, []);
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [view, round]);

  // a fresh launch always starts at Home with a clean history entry
  useEffect(() => { if (history.state?.view) history.replaceState(null, ''); }, []);

  const open = useCallback((v: Exclude<View, 'home'>) => {
    if (history.state?.view) history.replaceState({ view: v }, '');
    else history.pushState({ view: v }, '');
    setMotion('forward');
    setRound((r) => r + 1);
    setView(v);
    window.scrollTo(0, 0);
  }, []);

  const goHome = useCallback((animate = true) => {
    skipMotion.current = !animate;
    if (history.state?.view) history.back(); // popstate below finishes the job
    else {
      setMotion(animate ? 'back' : 'none');
      setRound((r) => r + 1);
      setView('home');
      window.scrollTo(0, 0);
    }
  }, []);

  useEffect(() => {
    const onPop = () => {
      setMotion(skipMotion.current ? 'none' : 'back');
      skipMotion.current = false;
      setRound((r) => r + 1);
      setView('home');
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const swipeBack = useCallback(() => goHome(false), [goHome]);
  useEdgeSwipe(view !== 'home', swipeBack);

  const startPractice = useCallback(() => {
    if (!practiceBank) return;
    let items: PracticeSession['items'] = [];
    update((s) => { items = drawPractice(practiceBank, s); });
    setPractice({ items, index: 0 });
    haptic();
    open('practice');
  }, [practiceBank, update, open]);

  /* Acronym Blitz: Home opens the intro; Start / Play again begin a round straight away */
  const openBlitz = useCallback(() => {
    setBlitz({ phase: 'intro' });
    haptic();
    open('blitz');
  }, [open]);

  const startBlitz = useCallback(() => {
    haptic();
    setBlitz({ phase: 'play', round: Date.now() });
    window.scrollTo(0, 0);
  }, []);

  const endBlitz = useCallback((result: BlitzResult) => {
    let info = { prevBest: 0, xp: 0, rate: 1 };
    update((s) => { info = finishBlitz(s, result); });
    haptic('success');
    setBlitz({ phase: 'done', result, ...info });
    window.scrollTo(0, 0);
  }, [update]);

  const blitzAnswer = useCallback((a: Acronym, ok: boolean) => {
    update((s) => logBlitzAnswer(s, a, ok));
  }, [update]);

  /* Spot the Phish: Home opens the intro (pick a level); Start / Play again deal a round of 10 */
  const level = levelInfo(state?.xp ?? 0).level;
  const unlockedTier = ([...TIERS].reverse().find((t) => level >= t.unlock)?.tier ?? 1) as Tier;
  const tier: Tier = phishTier && level >= TIERS[phishTier - 1].unlock ? phishTier : unlockedTier;

  /* Every round has a new cast of fictional organisations. The intro shows the Directory for the
     round you're about to play; Play again deals a fresh cast. */
  const openPhish = useCallback(() => {
    if (phishBank) setPhishCast((prev) => pickCast(phishBank.casts, prev));
    setPhish({ phase: 'intro' });
    haptic();
    open('phish');
  }, [open, phishBank]);

  const startPhish = useCallback(() => {
    const s = stateRef.current;
    if (!phishBank || !s) return;
    haptic();
    const cast = phishCast ?? pickCast(phishBank.casts);
    setPhishCast(cast);
    const cards = drawRound(phishBank.cards, tier, s.phish.seen, s.phish.rounds).map((c) => applyCast(c, cast));
    setPhish({ phase: 'play', round: Date.now(), tier, cards });
    window.scrollTo(0, 0);
  }, [phishBank, tier, phishCast]);

  const phishAnswer = useCallback((c: PhishCard, saidPhish: boolean) => {
    update((s) => logPhishAnswer(s, c, saidPhish));
  }, [update]);

  const endPhish = useCallback((result: PhishResult) => {
    let info = { prevBest: 0, xp: 0, rate: 1 };
    update((s) => { info = finishPhish(s, result); });
    haptic('success');
    setPhish((p) => ({ phase: 'done', result, ...info, cards: p.phase === 'intro' ? [] : p.cards }));
    window.scrollTo(0, 0);
  }, [update]);

  /* Play again goes back to the game's start page (rules, level, best), never straight into a round */
  const againBlitz = useCallback(() => {
    haptic();
    setBlitz({ phase: 'intro' });
    window.scrollTo(0, 0);
  }, []);

  /* Incident Commander: Home opens the intro; Start plays the scenario; Play again returns to the intro */
  const openIncident = useCallback(() => {
    setIncident({ phase: 'intro' });
    haptic();
    open('incident');
  }, [open]);

  const startIncident = useCallback(() => {
    const scenario = incidentBank?.scenarios.find((x) => !x.soon && x.beats?.length);
    if (!incidentBank || !scenario) return;
    haptic();
    setIncident({ phase: 'play', round: Date.now(), run: newRun(incidentBank, scenario) });
    window.scrollTo(0, 0);
  }, [incidentBank]);

  const incidentDecision = useCallback((category: string, id: string, ok: boolean) => {
    update((s) => logIncidentDecision(s, category, id, ok));
  }, [update]);

  const endIncident = useCallback((result: IncidentResult) => {
    let info: { prevBest: string | null; xp: number; rate: number } = { prevBest: null, xp: 0, rate: 1 };
    update((s) => { info = finishIncident(s, result); });
    haptic('success');
    setIncident({ phase: 'done', result, ...info });
    window.scrollTo(0, 0);
  }, [update]);

  const againIncident = useCallback(() => {
    haptic();
    setIncident({ phase: 'intro' });
    window.scrollTo(0, 0);
  }, []);

  const againPhish = useCallback(() => {
    haptic();
    if (phishBank) setPhishCast((prev) => pickCast(phishBank.casts, prev)); // a new cast for the next round
    setPhish({ phase: 'intro' });
    window.scrollTo(0, 0);
  }, [phishBank]);

  /* End-of-round bar: Home next to the main button, so a stray tap doesn't start another round */
  const endBar = (label: string, onAgain: () => void) => (
    <div className="bar-pair">
      <button type="button" className="btn secondary" onClick={() => { haptic(); goHome(); }}><HomeIcon />Home</button>
      <button type="button" className="btn" onClick={onAgain}>{label}<ArrowIcon /></button>
    </div>
  );

  /* ---------- work out what to show ---------- */

  let body: ReactNode = null;
  let barButton: ReactNode = null;
  let reserveBar = false;
  let nav: { label: string; onHome: () => void } | undefined;

  if (load.status === 'loading') {
    body = <p className="status">Loading questions…</p>;
  } else if (load.status === 'error' || !state || !day) {
    body = <p className="status error">Couldn’t load questions.json. Check you’re online for the first launch.</p>;
  } else if (view === 'home') {
    body = (
      <Home
        day={day}
        learned={practiceIds(state, practiceBank!).length}
        due={dueIds(state, practiceBank!).length}
        onDaily={() => { haptic(); open('daily'); }}
        onProfile={() => { haptic(); open('profile'); }}
        level={levelInfo(state.xp)}
        onPractice={startPractice}
        blitz={{ best: state.blitz.best, available: (acronyms?.length ?? 0) >= 4 }}
        onBlitz={openBlitz}
        phish={{ best: state.phish.best, available: !!phishBank }}
        onPhish={openPhish}
        incident={{ best: Object.values(state.incident.best).sort()[0] ?? null, available: !!incidentBank }}
        onIncident={openIncident}
      />
    );
  } else if (view === 'daily') {
    nav = { label: 'Today’s 10', onHome: () => goHome() };
    if (dayDone) {
      body = <DoneView mode="daily" items={day.items} byId={byId} countdown={countdown} />;
    } else {
      const item = day.items[day.index];
      const q = byId.get(item.id);
      if (q) {
        body = (
          <QuestionView
            mode="daily"
            items={day.items}
            index={day.index}
            question={q}
            onAnswer={(i) => {
              haptic(item.order[i] === q.correctIndex ? 'success' : 'error');
              update((s) => answer(s, bank!, i));
            }}
            onHint={() => update((s) => { if (s.day) s.day.items[s.day.index].hint = true; })}
          />
        );
      }
      if (item.chosen !== null) {
        const last = day.index === day.items.length - 1;
        barButton = (
          <button
            type="button"
            className="btn"
            onClick={() => { update((s) => { if (s.day) s.day.index += 1; }); window.scrollTo(0, 0); }}
          >
            {last ? 'See today’s results' : 'Next question'}
            <ArrowIcon />
          </button>
        );
      }
    }
  } else if (view === 'profile') {
    nav = { label: 'Profile', onHome: () => goHome() };
    body = (
      <Profile
        state={state}
        bank={bank!}
        practiceBank={practiceBank!}
        acronyms={acronyms ?? []}
        streak={shownStreak(state)}
        onDaily={() => open('daily')}
      />
    );
  } else if (view === 'practice' && practice) {
    nav = { label: 'Practice', onHome: () => goHome() };
    if (practice.index >= practice.items.length) {
      body = (
        <DoneView
          mode="practice"
          items={practice.items}
          byId={practiceById}
          strength={(id) => state.srs[id]?.box ?? 1}
        />
      );
      barButton = endBar('Another round', startPractice);
    } else {
      const item = practice.items[practice.index];
      const q = practiceById.get(item.id);
      if (q) {
        body = (
          <QuestionView
            mode="practice"
            items={practice.items}
            index={practice.index}
            question={q}
            strength={item.chosen !== null && state.srs[item.id]
              ? { box: state.srs[item.id].box, days: daysUntil(state.srs[item.id].due), wasEarly: practice.items[practice.index].early }
              : undefined}
            onAnswer={(i) => {
              const ok = item.order[i] === q.correctIndex;
              haptic(ok ? 'success' : 'error');
              update((s) => recordResult(s, q, 'practice', ok)); // moves it between boxes + logs it
              setPractice((p) => {
              if (!p) return p;
              const items = p.items.map((it, n) => n === p.index && it.chosen === null
                ? { ...it, chosen: i, correct: it.order[i] === q.correctIndex }
                : it);
              return { ...p, items };
            }); }}
            onHint={() => setPractice((p) => p && {
              ...p,
              items: p.items.map((it, n) => (n === p.index ? { ...it, hint: true } : it))
            })}
          />
        );
      }
      if (item.chosen !== null) {
        const last = practice.index === practice.items.length - 1;
        barButton = (
          <button
            type="button"
            className="btn"
            onClick={() => { setPractice((p) => p && { ...p, index: p.index + 1 }); window.scrollTo(0, 0); }}
          >
            {last ? 'See results' : 'Next question'}
            <ArrowIcon />
          </button>
        );
      }
    }
  } else if (view === 'blitz' && acronyms) {
    nav = { label: 'Acronym Blitz', onHome: () => goHome() };
    if (blitz.phase === 'play') {
      body = <BlitzGame key={blitz.round} bank={acronyms} rightAt={state.blitz.rightAt} onAnswer={blitzAnswer} onEnd={endBlitz} />;
    } else {
      body = blitz.phase === 'intro'
        ? <BlitzIntro best={state.blitz.best} roundsToday={blitzRoundsToday(state)} />
        : <BlitzDone result={blitz.result} prevBest={blitz.prevBest} best={state.blitz.best} xp={blitz.xp} rate={blitz.rate} byId={acronymById} />;
      barButton = blitz.phase === 'intro'
        ? <button type="button" className="btn" onClick={startBlitz}>Start<ArrowIcon /></button>
        : endBar('Play again', againBlitz);
    }
  } else if (view === 'incident' && incidentBank) {
    nav = { label: 'Incident Commander', onHome: () => goHome() };
    if (incident.phase === 'play') {
      body = (
        <IncidentGame key={incident.round} run={incident.run} people={incidentBank.people} timed={timed}
          onDecision={incidentDecision} onEnd={endIncident} />
      );
    } else if (incident.phase === 'intro') {
      body = <IncidentIntro bank={incidentBank} level={level} best={state.incident.best} timed={timed} onTimed={setTimed}
        roundsToday={incidentRoundsToday(state)} />;
      barButton = <button type="button" className="btn" onClick={startIncident}>Start the incident<ArrowIcon /></button>;
    } else {
      body = <IncidentDebrief result={incident.result} prevBest={incident.prevBest} xp={incident.xp} rate={incident.rate} />;
      barButton = endBar('Play again', againIncident);
    }
  } else if (view === 'phish' && phishBank) {
    nav = { label: 'Spot the Phish', onHome: () => goHome() };
    if (phish.phase === 'play') {
      reserveBar = true; // the game draws its own Phish / Legit buttons in the action bar
      body = (
        <PhishGame
          key={phish.round}
          cards={phish.cards}
          tier={phish.tier}
          onAnswer={phishAnswer}
          onEnd={endPhish}
          onDirectory={() => setShowDirectory(true)}
        />
      );
    } else {
      body = phish.phase === 'intro'
        ? <PhishIntro level={level} tier={tier} onTier={setPhishTier} best={state.phish.best}
            roundsToday={phishRoundsToday(state)} onDirectory={() => setShowDirectory(true)} />
        : <PhishDone result={phish.result} prevBest={phish.prevBest} best={state.phish.best} xp={phish.xp} rate={phish.rate} byId={new Map(phish.cards.map((c) => [c.id, c]))} />;
      const name = TIERS[tier - 1].name;
      barButton = phish.phase === 'intro'
        ? <button type="button" className="btn" onClick={startPhish}>{`Start ${name} round`}<ArrowIcon /></button>
        : endBar('Play again', againPhish);
    }
  }

  /* While a game is being played it goes full screen: no header, just a floating back button */
  const immersive = (view === 'blitz' && blitz.phase === 'play') || (view === 'phish' && phish.phase === 'play') ||
    (view === 'incident' && incident.phase === 'play');

  return (
    <>
      <div className={'app' + (barButton || reserveBar ? ' has-bar' : '') + (immersive ? ` immersive immersive-${view}` : '')}>
        {immersive ? (
          <button type="button" className="float-back" onClick={() => goHome()} aria-label="Back to Home"><BackIcon /></button>
        ) : (
          <Header
            ready={state !== null}
            streak={state ? shownStreak(state) : 0}
            freezes={state?.freezes ?? 0}
            level={levelInfo(state?.xp ?? 0).level}
            levelProgress={levelInfo(state?.xp ?? 0).progress}
            onProfile={view === 'home' && state ? () => { haptic(); open('profile'); } : undefined}
            nav={nav}
          />
        )}
        <main key={view + round} className={'screen screen-' + motion}>{body}</main>
      </div>

      {/* Countdown pill lives outside the animated screen so it always stays pinned bottom right */}
      {view === 'home' && dayDone && (
        <div className="next-pill" role="status">
          <ClockIcon />
          <span>Next set</span>
          <strong>{countdown}</strong>
        </div>
      )}

      {/* Level-ups, badges and streak news: only on calm screens, never mid-question */}
      {state && state.celebrations.length > 0 && (
        view === 'home' || view === 'profile' ||
        (view === 'daily' && dayDone) ||
        (view === 'practice' && practice && practice.index >= practice.items.length) ||
        (view === 'blitz' && blitz.phase !== 'play') ||
        (view === 'phish' && phish.phase !== 'play') ||
        (view === 'incident' && incident.phase !== 'play')
      ) && (
        <Celebration
          key={state.celebrations.length + (state.celebrations[0].id ?? state.celebrations[0].kind)}
          item={state.celebrations[0]}
          state={state}
          onDone={() => update((s) => { s.celebrations.shift(); })}
          onProfile={() => open('profile')}
        />
      )}

      {barButton && (
        <div className="actionbar">
          <div className="actionbar-inner">{barButton}</div>
        </div>
      )}

      {/* Spot the Phish Directory: genuine domains and numbers, open from the intro or mid-round */}
      {showDirectory && view === 'phish' && phishCast && (
        <DirectorySheet directory={directoryFor(phishCast)} onClose={() => setShowDirectory(false)} />
      )}
    </>
  );
}
