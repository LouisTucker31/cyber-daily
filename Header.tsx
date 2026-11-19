interface Props {
  streak: number;
}

export default function Header({ streak }: Props) {
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <header className="topbar">
      <div>
        <h1 className="wordmark">Cyber Daily <span>10</span></h1>
        <div className="today">{today}</div>
      </div>
      <div className={'streak' + (streak > 0 ? ' live' : '')}>
        <div className="streak-label">Streak</div>
        <div className="streak-value">
          {streak}<small>{streak === 1 ? 'day' : 'days'}</small>
        </div>
      </div>
    </header>
  );
}
