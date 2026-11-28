import { useId, useState } from 'react';
import { useRadio } from './radio-context.js';
import { formatPlayTime } from '../lib/radio-schedule.js';
import './HomeUpcoming.css';

export default function HomeUpcoming() {
  const { status, upcoming = [] } = useRadio();
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  if (status !== 'playing' || !upcoming.length) return null;
  return <section className="home-upcoming" aria-label="Coming up on Santa Radio">
    <h2 className="home-upcoming__heading">Coming up</h2>
    <button className="home-upcoming__toggle" type="button" aria-expanded={expanded}
      aria-controls={listId} onClick={() => setExpanded(value => !value)}>
      Coming up
      <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 7 5 5 5-5" /></svg>
    </button>
    <ol id={listId} className={`home-upcoming__list${expanded ? ' home-upcoming__list--expanded' : ''}`}>{upcoming.slice(0, 3).map((track, index) => <li key={`${index}-${track.artist}-${track.title}`}>
      <span className="home-upcoming__track"><strong>{track.artist}</strong> — {track.title}</span>
      {track.estimatedAt !== null && <time dateTime={new Date(track.estimatedAt).toISOString()}>{formatPlayTime(track.estimatedAt)} approx.</time>}
    </li>)}</ol>
  </section>;
}
