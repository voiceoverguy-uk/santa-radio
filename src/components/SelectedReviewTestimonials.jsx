import { useEffect, useState } from 'react';
import './SelectedReviewTestimonials.css';
const ROTATION_KEY = 'santa-approved-review-offset';
export default function SelectedReviewTestimonials({ fallback = null }) {
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    let active = true;
    let offset = '0';
    try { offset = localStorage.getItem(ROTATION_KEY) || '0'; } catch { /* Storage is optional. */ }
    fetch(`/api/santa-reviews?view=featured&offset=${encodeURIComponent(offset)}`, {cache:'no-store'})
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!active || !Array.isArray(data?.reviews)) return;
        const chosen = data.reviews.slice(0, 3);
        for (let i = chosen.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
        }
        try {
          const previousOrder = localStorage.getItem('santa-approved-review-order');
          if (chosen.length > 1 && chosen.map(review => review.id).join(',') === previousOrder) chosen.push(chosen.shift());
          localStorage.setItem('santa-approved-review-order', chosen.map(review => review.id).join(','));
        } catch { /* Random order still works without storage. */ }
        setReviews(chosen);
        try { localStorage.setItem(ROTATION_KEY, String(data.nextOffset || 0)); } catch { /* Storage is optional. */ }
      }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!reviews.length) return fallback;
  return <section className="selected-reviews" aria-labelledby="selected-reviews-title">
    <h2 id="selected-reviews-title">A little Christmas magic, shared</h2>
    <p className="selected-reviews__note">Selected reviews. Reviewers were offered 20% off for honest feedback, whatever their rating.</p>
    <div className="selected-reviews__grid">{reviews.map(review => <figure className="selected-reviews__card" key={review.id}>
      <p className="selected-reviews__stars" role="img" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</p>
      <blockquote>{review.body} <span className="selected-reviews__author">— {review.displayName}</span></blockquote>
    </figure>)}</div>
  </section>;
}
