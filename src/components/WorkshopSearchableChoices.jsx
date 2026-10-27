import { useId, useRef, useState } from 'react';
import WorkshopChoiceWheel from './WorkshopChoiceWheel.jsx';
import WorkshopWordingPreview from './WorkshopWordingPreview.jsx';
import { filterWorkshopChoices, workshopSearchTerms } from '../lib/workshopChoiceSearch.js';
import './WorkshopSearchableChoices.css';

const searchLabels = {
  activity: ['Search activities', 'Try football or toys'],
  achievement: ['Search achievements', 'Try school or helping'],
  treat: ['Search treats', 'Try chocolate or biscuits'],
  place: ['Search locations', 'Try a country or fantasy'],
};

export default function WorkshopSearchableChoices({ category, label, options, value, onChange, invalid, onTick, onSoundInteraction, wording }) {
  const [query, setQuery] = useState('');
  const inputId = useId();
  const inputRef = useRef(null);
  const matches = filterWorkshopChoices(options, query);
  const currentSelectionLabel = options.find(option => option.id === value)?.label || '';
  const [searchLabel, placeholder] = searchLabels[category];
  return (
    <div className={`smw-activity-preview-layout smw-searchable-layout smw-searchable-${category}`}>
      <div className="smw-choice-search" role="search" aria-label={searchLabel}>
        <div className="smw-choice-search-controls">
          <input id={inputId} ref={inputRef} type="search" value={query} maxLength={100}
            aria-label={searchLabel}
            aria-controls={`${inputId}-results`}
            autoComplete="off" spellCheck={false} placeholder={placeholder}
            onChange={event => setQuery(event.target.value)} />
          <button type="button" disabled={!query} onClick={() => {
            setQuery('');
            inputRef.current?.focus({ preventScroll: true });
          }}>Clear</button>
        </div>
      </div>
      <div className="smw-filtered-wheel" id={`${inputId}-results`}>
        {matches.length ? <WorkshopChoiceWheel
          key={workshopSearchTerms(query).join(' ')}
          showCount={false} label={label} options={matches} value={value}
          currentSelectionLabel={currentSelectionLabel}
          onChange={onChange} invalid={invalid} onTick={onTick} onSoundInteraction={onSoundInteraction}
        /> : <div className="smw-search-empty" role="status">
          <p>No matching choices. Try another word or clear the search.</p>
          {currentSelectionLabel && <p>Selected: {currentSelectionLabel}</p>}
        </div>}
      </div>
      <WorkshopWordingPreview wording={wording} heading={category === 'activity' ? 'Santa will say:' : 'Santa will say…'} />
    </div>
  );
}
