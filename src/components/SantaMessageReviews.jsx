import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import "./SantaMessageReviews.css";

const reviews = [
  { quote: "So fun and so simple to use", attribution: "Karen, West Yorkshire" },
  { quote: "Kids loved it. I still can’t believe how easy it was", attribution: "Michael, Redruth" },
  { quote: "My daughter loved it, thank you. She wanted to know how Santa knew about her swimming", attribution: "Darren, Wimbledon" },
  { quote: "Ho Ho Ho! Merry Christmas. Thanks.", attribution: "Susan, Wakefield" },
  { quote: "A proper treat, not seen anything like this. Super Easy.", attribution: "Paul, Tadely, Berkshire" },
];

function SantaMessageReviews() {
  const [activeReview, setActiveReview] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return undefined;

    const intervalId = window.setInterval(() => {
      setActiveReview((current) => (current + 1) % reviews.length);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [isPaused]);

  const review = reviews[activeReview];

  return (
    <section className="santa-message-reviews" aria-label="Customer reviews">
      <div className="santa-message-reviews__heading">
        <p className="santa-message-reviews__eyebrow">Kind words from families</p>
        <div className="santa-message-reviews__rating" role="img" aria-label="5 out of 5 stars">
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} aria-hidden="true" />
          ))}
        </div>
      </div>

      <div className="santa-message-reviews__stage">
        <div className="santa-message-reviews__reserve" aria-hidden="true">
          {reviews.map((item) => (
            <div className="santa-message-reviews__item" key={item.attribution}>
              <p className="santa-message-reviews__quote">{item.quote}</p>
              <p className="santa-message-reviews__attribution">{item.attribution}</p>
            </div>
          ))}
        </div>
        <div className="santa-message-reviews__current" key={activeReview}>
          <blockquote className="santa-message-reviews__quote">{review.quote}</blockquote>
          <p className="santa-message-reviews__attribution">{review.attribution}</p>
        </div>
      </div>

      <button
        className="santa-message-reviews__toggle"
        type="button"
        onClick={() => setIsPaused((paused) => !paused)}
      >
        {isPaused ? "Resume reviews" : "Pause reviews"}
      </button>
    </section>
  );
}

export default SantaMessageReviews;
