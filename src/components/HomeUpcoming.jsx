import { useRadio } from './radio-context.js';
import { formatPlayTime } from '../lib/radio-schedule.js';
import './HomeUpcoming.css';

export default function HomeUpcoming() {
  const { status, upcoming = [] } = useRadio();
  if (status !== 'playing' || !upcoming.length) return null;
  return <section className="home-upcoming" aria-label="Coming up on Santa Radio">
    <h2>Coming up</h2>
    <ol>{upcoming.slice(0, 3).map((track, index) => <li key={`${index}-${track.artist}-${track.title}`}>
      <span className="home-upcoming__track"><strong>{track.artist}</strong> — {track.title}</span>
      {track.estimatedAt !== null && <time dateTime={new Date(track.estimatedAt).toISOString()}>{formatPlayTime(track.estimatedAt)} approx. *</time>}
    </li>)}</ol>
  </section>;
}
