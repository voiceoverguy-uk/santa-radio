import { films } from './films.js';
import { Link } from 'react-router-dom';
import './santa-knows-christmas.css';

export default function ChristmasStudyPromo() {
  return (
    <section className="christmas-study-promo" aria-labelledby="christmas-study-promo-title">
      <h2 id="christmas-study-promo-title">Santa Knows Christmas</h2>
      <p>Santa’s watched {films.length} Christmas films and specials. Can he guess yours in 20 questions?</p>
      <Link to="/santa-knows-christmas">Play now</Link>
    </section>
  );
}
