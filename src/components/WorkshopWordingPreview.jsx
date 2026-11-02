import { useId } from 'react';

export default function WorkshopWordingPreview({ wording, name = '', heading = 'Santa will say…', selectedText = '' }) {
  const headingId = useId();
  return (
    <aside className="smw-activity-wording" aria-labelledby={headingId}>
      <h4 id={headingId}>{heading}</h4>
      <p className="smw-activity-wording-quote">
        {wording.replace('{name}', () => name)}
        {selectedText && <span className="smw-wording-selection"> {selectedText}</span>}
      </p>
    </aside>
  );
}
