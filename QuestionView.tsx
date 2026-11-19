import { useEffect, useRef } from 'react';
import { LETTERS, type Question } from './quiz.ts';
import Ticks from './Ticks.tsx';
import { CrossIcon, TickIcon } from './icons.tsx';

export interface AnswerItem {
  id: string;
  order: number[];
  chosen: number | null;
  correct: boolean | null;
  hint: boolean;
  review?: boolean;
}

interface Props {
  mode: 'daily' | 'practice';
  items: AnswerItem[];
  index: number;
  question: Question;
  onAnswer: (displayIdx: number) => void;
  onHint: () => void;
}

export default function QuestionView({ mode, items, index, question: q, onAnswer, onHint }: Props) {
  const item = items[index];
  const answered = item.chosen !== null;
  const practice = mode === 'practice';
  const rightSoFar = items.filter((it) => it.correct === true).length;
  const resultRef = useRef<HTMLElement>(null);

  // bring the result into view (clear of the button bar) once answered
  useEffect(() => {
    if (!answered) return;
    const id = requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    );
    return () => cancelAnimationFrame(id);
  }, [answered, item.id]);

  return (
    <>
      <div className="progress">
        <div className="progress-meta">
          <span>Question <b>{index + 1}</b> of {items.length}</span>
          <span>{rightSoFar} correct</span>
        </div>
        <Ticks items={items} current={index} />
      </div>

      <p className="category">
        {q.category}
        {item.review && <>{q.category ? ' · ' : ''}<span className="review">Review</span></>}
      </p>
      <h2 className="question">{q.question}</h2>

      <ul className="options">
        {item.order.map((origIdx, displayIdx) => {
          const picked = answered && displayIdx === item.chosen;
          // in Practice, a wrong answer also shows which one was right
          const reveal = practice && answered && !item.correct && origIdx === q.correctIndex;
          let cls = 'option';
          if (answered) {
            if (picked) cls += item.correct ? ' picked-right' : ' picked-wrong';
            else if (reveal) cls += ' reveal';
            else cls += ' dim';
          }
          return (
            <li key={origIdx}>
              <button type="button" className={cls} disabled={answered} onClick={() => onAnswer(displayIdx)}>
                <span className="key">
                  {picked ? (item.correct ? <TickIcon /> : <CrossIcon />) : reveal ? <TickIcon /> : LETTERS[displayIdx]}
                </span>
                <span>{q.options[origIdx]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {q.hint && item.hint && <div className="hint"><b>Hint</b>{q.hint}</div>}
      {q.hint && !item.hint && !answered && (
        <button type="button" className="hint-toggle" onClick={onHint}>Show a hint</button>
      )}

      {answered && (
        <section ref={resultRef} className={'result ' + (item.correct ? 'right' : 'wrong')}>
          <h3 className="result-head">
            {item.correct ? <TickIcon /> : <CrossIcon />}
            {item.correct ? 'Correct' : 'Not this time'}
          </h3>
          {practice ? (
            <>
              {!item.correct && <p className="note">The right answer is marked above.</p>}
              {q.explanation && <p>{q.explanation}</p>}
            </>
          ) : item.correct ? (
            <>
              {q.explanation && <p>{q.explanation}</p>}
              {!item.review && <p className="note">Ticked off. It won’t come up again this round.</p>}
            </>
          ) : (
            <p>
              {item.review
                ? 'This was a review question, so your progress isn’t affected.'
                : 'This one goes back in the pot. You’ll get another go on a later day.'}
            </p>
          )}
        </section>
      )}
    </>
  );
}
