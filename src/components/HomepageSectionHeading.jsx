import { Star } from 'lucide-react';
import './HomepageSectionHeading.css';

export default function HomepageSectionHeading({
  eyebrow,
  title,
  subtitle,
  supportingLine,
  titleId,
  className = '',
  eyebrowClassName = '',
  titleClassName = '',
  subtitleClassName = '',
}) {
  return (
    <div className={`homepage-section-heading ${className}`.trim()}>
      <p className={`homepage-section-heading__eyebrow ${eyebrowClassName}`.trim()}>{eyebrow}</p>
      <div className="homepage-section-heading__title-wrap">
        <span className="homepage-section-heading__divider" aria-hidden="true">
          <Star size={17} fill="currentColor" />
        </span>
        <h2 id={titleId} className={`homepage-section-heading__title ${titleClassName}`.trim()}>
          {title}
        </h2>
      </div>
      {supportingLine && <p className="homepage-section-heading__supporting">{supportingLine}</p>}
      <p className={`homepage-section-heading__subtitle ${subtitleClassName}`.trim()}>{subtitle}</p>
    </div>
  );
}
