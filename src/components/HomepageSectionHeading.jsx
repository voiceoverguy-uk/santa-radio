import { Star } from 'lucide-react';
import './HomepageSectionHeading.css';

export default function HomepageSectionHeading({
  eyebrow,
  title,
  subtitle,
  supportingLine,
  titleId,
  titleTag: Title = 'h2',
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
          <span className="homepage-section-heading__divider-line" />
          <Star size={17} fill="currentColor" />
          <span className="homepage-section-heading__divider-line" />
        </span>
        <Title id={titleId} className={`homepage-section-heading__title ${titleClassName}`.trim()}>
          {title}
        </Title>
      </div>
      {supportingLine && <p className="homepage-section-heading__supporting">{supportingLine}</p>}
      {subtitle && <p className={`homepage-section-heading__subtitle ${subtitleClassName}`.trim()}>{subtitle}</p>}
    </div>
  );
}
