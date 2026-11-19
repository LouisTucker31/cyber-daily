import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  answer, completeDay, dateKey, ensureToday, loadState, parseBank, saveState, shownStreak,
  type Question, type State
} from './quiz.ts';
import Header from './Header.tsx';
import QuestionView from './QuestionView.tsx';
import DoneView from './DoneView.tsx';
import { ArrowIcon } from './icons.tsx';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; bank: Question[] };

export default function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [state, setState] = useState<State | null>(null);
  const stateRef = useRef<State | null>(null);

  const bank = load.status === 'ready' ? load.bank : null;
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
  const finished = !!day && day.items.length > 0 && day.index >= day.items.length;

  // record the streak once the day's set is finished
  useEffect(() => {
    if (finished && day && !day.completed) update(completeDay);
  }, [finished, day, update]);

  const item = day && !finished ? day.items[day.index] : null;
  const question = item ? byId.get(item.id) : undefined;
  const showBar = !!item && item.chosen !== null;

  let body: ReactNode;
  if (load.status === 'loading') {
    body = <p className="status">Loading questions…</p>;
  } else if (load.status === 'error') {
    body = <p className="status error">Couldn’t load questions.json. Check you’re online for the first launch.</p>;
  } else if (!day || day.items.length === 0) {
    body = <p className="status error">No questions found in questions.json.</p>;
  } else if (finished) {
    body = <DoneView day={day} byId={byId} onNewDay={rollover} />;
  } else if (question) {
    body = (
      <QuestionView
        day={day}
        question={question}
        onAnswer={(i) => bank && update((s) => answer(s, bank, i))}
        onHint={() => update((s) => { if (s.day) s.day.items[s.day.index].hint = true; })}
      />
    );
  }

  const isLast = !!day && day.index === day.items.length - 1;

  return (
    <>
      <div className={'app' + (showBar ? ' has-bar' : '')}>
        <Header streak={state ? shownStreak(state) : 0} />
        <main>{body}</main>
      </div>

      {showBar && (
        <div className="actionbar">
          <div className="actionbar-inner">
            <button
              type="button"
              className="btn"
              onClick={() => {
                update((s) => { if (s.day) s.day.index += 1; });
                window.scrollTo(0, 0);
              }}
            >
              {isLast ? 'See today’s results' : 'Next question'}
              <ArrowIcon />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
