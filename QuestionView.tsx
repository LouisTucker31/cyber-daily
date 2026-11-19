import { useEffect, useRef } from 'react';
import { LETTERS, type Day, type Question } from './quiz.ts';
import Ticks from './Ticks.tsx';
import { CrossIcon, TickIcon } from './icons.tsx';

interface Props {
  day: Day;
  question: Question;
  onAnswer: (displayIdx: number) => void;
  onHint: () => void;
}

export default function QuestionView({ day, question: q, onAnswer, onHint }: Props) {
  const item = day.items[day.index];
  const answered = item.chosen !== null;
  const rightSoFar = day.items.filter((it) => it.correct === true).length;
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
          <span>Question <b>{day.index + 1}</b> of {day.items.length}</span>
          <span>{rightSoFar} correct</span>
        </div>
        <Ticks items={day.items} current={day.index} />
      </div>

      <p className="category">
        {q.category}
        {item.review && <>{q.category ? ' · ' : ''}<span className="review">Review</span></>}
      </p>
      <h2 className="question">{q.question}</h2>

      <ul className="options">
        {item.order.map((origIdx, displayIdx) => {
          const picked = answered && displayIdx === item.chosen;
          let cls = 'option';
          if (answered) cls += picked ? (item.correct ? ' picked-right' : ' picked-wrong') : ' dim';
          return (
            <li key={origIdx}>
              <button
                type="button"
                className={cls}
                disabled={answered}
                onClick={() => onAnswer(displayIdx)}
              >
                <span className="key">
                  {picked ? (item.correct ? <TickIcon /> : <CrossIcon />) : LETTERS[displayIdx]}
                </span>
                <span>{q.options[origIdx]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {q.hint && item.hint && (
        <div className="hint"><b>Hint</b>{q.hint}</div>
      )}
      {q.hint && !item.hint && !answered && (
        <button type="button" className="hint-toggle" onClick={onHint}>Show a hint</button>
      )}

      {answered && (
        <section ref={resultRef} className={'result ' + (item.correct ? 'right' : 'wrong')}>
          <h3 className="result-head">
            {item.correct ? <TickIcon /> : <CrossIcon />}
            {item.correct ? 'Correct' : 'Not this time'}
          </h3>
          {item.correct ? (
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
