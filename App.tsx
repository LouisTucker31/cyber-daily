import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  answer, completeDay, dateKey, daysUntil, drawPractice, dueIds, ensureToday, learnedIds, loadState, parseBank,
  recordResult, saveState,
  shownStreak, type PracticeSession, type Question, type State
} from './quiz.ts';
import Header from './Header.tsx';
import Home from './Home.tsx';
import QuestionView from './QuestionView.tsx';
import DoneView from './DoneView.tsx';
import Profile from './Profile.tsx';
import Celebration from './Celebration.tsx';
import { evaluateProgress, levelInfo } from './progress.ts';
import useCountdown from './useCountdown.ts';
import useEdgeSwipe from './useEdgeSwipe.ts';
import { haptic } from './haptics.ts';
import { ArrowIcon, ClockIcon } from './icons.tsx';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; bank: Question[] };
type View = 'home' | 'daily' | 'practice' | 'profile';
type Motion = 'forward' | 'back' | 'none';

export default function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [state, setState] = useState<State | null>(null);
  const stateRef = useRef<State | null>(null);
  const [view, setView] = useState<View>('home');
  const [practice, setPractice] = useState<PracticeSession | null>(null);
  const [motion, setMotion] = useState<Motion>('none');
  const [round, setRound] = useState(0); // bumps on each new screen so the slide animation replays

  const bank = load.status === 'ready' ? load.bank : null;
  const bankRef = useRef<Question[]>([]);
  const byId = useMemo(() => new Map((bank ?? []).map((q) => [q.id, q])), [bank]);

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
    evaluateProgress(next, bankRef.current); // XP level-ups, badges
    commit(next);
  }, [commit]);

  // load questions
  useEffect(() => {
    fetch('questions.json', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((data) => {
        const b = parseBank(data);
        const s = loadState();
        ensureToday(s, b);
        bankRef.current = b;
        // first run with levels: count past progress quietly, then show one welcome sheet
        evaluateProgress(s, b, s.celebrations.some((c) => c.kind === 'welcome'));
        commit(s);
        setLoad({ status: 'ready', bank: b });
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
    if (!bank) return;
    let items: PracticeSession['items'] = [];
    update((s) => { items = drawPractice(bank, s); });
    setPractice({ items, index: 0 });
    haptic();
    open('practice');
  }, [bank, update, open]);

  /* ---------- work out what to show ---------- */

  let body: ReactNode = null;
  let barButton: ReactNode = null;
  let nav: { label: string; onHome: () => void } | undefined;

  if (load.status === 'loading') {
    body = <p className="status">Loading questions…</p>;
  } else if (load.status === 'error' || !state || !day) {
    body = <p className="status error">Couldn’t load questions.json. Check you’re online for the first launch.</p>;
  } else if (view === 'home') {
    body = (
      <Home
        day={day}
        learned={learnedIds(state, bank!).length}
        due={dueIds(state, bank!).length}
        onDaily={() => { haptic(); open('daily'); }}
        onProfile={() => { haptic(); open('profile'); }}
        level={levelInfo(state.xp)}
        onPractice={startPractice}
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
        streak={shownStreak(state)}
        onDaily={() => open('daily')}
        onPractice={startPractice}
      />
    );
  } else if (view === 'practice' && practice) {
    nav = { label: 'Practice', onHome: () => goHome() };
    if (practice.index >= practice.items.length) {
      body = (
        <DoneView
          mode="practice"
          items={practice.items}
          byId={byId}
          strength={(id) => state.srs[id]?.box ?? 1}
        />
      );
      barButton = (
        <button type="button" className="btn" onClick={startPractice}>
          Another round
          <ArrowIcon />
        </button>
      );
    } else {
      const item = practice.items[practice.index];
      const q = byId.get(item.id);
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
  }

  return (
    <>
      <div className={'app' + (barButton ? ' has-bar' : '')}>
        <Header
          streak={state ? shownStreak(state) : 0}
          freezes={state?.freezes ?? 0}
          level={levelInfo(state?.xp ?? 0).level}
          levelProgress={levelInfo(state?.xp ?? 0).progress}
          onProfile={view === 'home' && state ? () => { haptic(); open('profile'); } : undefined}
          nav={nav}
        />
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
        (view === 'practice' && practice && practice.index >= practice.items.length)
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
    </>
  );
}
