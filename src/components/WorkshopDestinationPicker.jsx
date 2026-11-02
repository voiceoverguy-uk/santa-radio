import { useMemo, useRef, useState } from 'react';
import WorkshopSearchableChoices from './WorkshopSearchableChoices.jsx';
import { workshopRegionalFolders } from '../lib/workshopDestinations.js';
import './WorkshopDestinationPicker.css';

const regionalFiles = Object.fromEntries(Object.entries(workshopRegionalFolders)
  .map(([folder, file]) => [file, folder]));

const regionalHeadings = {
  'usa-states': 'States in United States',
  'england-counties': 'Counties in England',
  'scotland-counties': 'Counties in Scotland',
  'wales-counties': 'Counties in Wales',
  'northern-ireland-counties': 'Counties in Northern Ireland',
};

export default function WorkshopDestinationPicker({
  options = [],
  regionalGroups = {},
  value,
  region = '',
  onChange,
  onRegionChange,
  invalid,
  onTick,
  onSoundInteraction,
  wording = '',
}) {
  const [showRegions, setShowRegions] = useState(false);
  const countryHeadingRef = useRef(null);
  const regionHeadingRef = useRef(null);
  const country = options.find(option => String(option.id) === String(value));
  const groupKey = regionalFiles[country?.file];
  const regionalGroup = groupKey ? regionalGroups[groupKey] : undefined;
  const availableRegions = regionalGroup?.parentId != null
    && String(regionalGroup.parentId) === String(value)
    && Array.isArray(regionalGroup.records)
    ? regionalGroup.records : [];
  const selectedRegion = useMemo(
    () => availableRegions.find(record => String(record.id) === String(region)),
    [availableRegions, region],
  );
  const canChooseRegion = Boolean(groupKey && regionalGroup && availableRegions.length);
  const guidance = groupKey && !canChooseRegion
    ? 'State and county choices are not available just yet. You can still choose this country.'
    : '';

  const focusHeading = ref => {
    window.requestAnimationFrame(() => {
      const heading = ref.current;
      if (!heading) return;
      heading.focus({ preventScroll: true });
      // Explicit view navigation may start from a button below the wheel.
      // Reveal its new heading once, never from a search-input focus/change.
      const clearance = (document.querySelector('.navbar')?.getBoundingClientRect().bottom || 0) + 16;
      const top = heading.getBoundingClientRect().top;
      if (top < clearance || top > window.innerHeight - 140) {
        window.scrollBy({ top: top - clearance, behavior: 'instant' });
      }
    });
  };

  const openRegions = () => {
    setShowRegions(true);
    focusHeading(regionHeadingRef);
  };
  const backToCountries = () => {
    setShowRegions(false);
    focusHeading(countryHeadingRef);
  };
  const useCountryOnly = () => {
    onRegionChange?.('');
    setShowRegions(false);
    focusHeading(countryHeadingRef);
  };

  return (
    <section className="smw-destination-picker" aria-label="Destination">
      <div className="smw-destination-picker__summary" aria-live="polite">
        {selectedRegion && country && (
          <div className="smw-destination-picker__selection">
            <p><span>Selected destination</span><strong>{selectedRegion.label}, {country.label}</strong></p>
            <div className="smw-destination-picker__selection-actions">
              <button type="button" onClick={openRegions}>Change {groupKey === 'usa-states' ? 'state' : 'county'}</button>
              <button type="button" onClick={useCountryOnly}>Use {country.label} only</button>
            </div>
          </div>
        )}
      </div>

      <div className="smw-destination-picker__country" hidden={showRegions}>
        <h3 ref={countryHeadingRef} tabIndex={-1} className="smw-destination-picker__heading">
          Choose a country
        </h3>
        <div className="smw-destination-picker__searchable">
          <WorkshopSearchableChoices
            category="place"
            label="A magical place"
            options={options}
            value={value}
            onChange={onChange}
            invalid={invalid}
            onTick={onTick}
            onSoundInteraction={onSoundInteraction}
            wording={wording}
            selectedText={selectedRegion?.label || country?.label || ''}
            wheelFooter={country && groupKey && (
              <div className="smw-destination-picker__region-prompt">
                <p>{guidance || 'Optional: make the destination more local, or continue with the country alone.'}</p>
                {canChooseRegion && <button type="button" onClick={openRegions}>
                  Choose a {groupKey === 'usa-states' ? 'state' : 'county'}
                </button>}
              </div>
            )}
          />
        </div>
      </div>

      {groupKey && canChooseRegion && (
        <div className="smw-destination-picker__regional" hidden={!showRegions}>
          <div className="smw-destination-picker__regional-head">
            <button type="button" onClick={backToCountries}>Back to countries</button>
            <h3 ref={regionHeadingRef} tabIndex={-1} className="smw-destination-picker__heading">
              {regionalHeadings[groupKey]}
            </h3>
          </div>
          <div className="smw-destination-picker__searchable">
            <WorkshopSearchableChoices
              key={groupKey}
              category="place"
              label={regionalHeadings[groupKey]}
              options={availableRegions}
              value={region}
              onChange={id => onRegionChange?.(String(id))}
              invalid={invalid}
              onTick={onTick}
              onSoundInteraction={onSoundInteraction}
              wording={wording}
              selectedText={selectedRegion?.label || country?.label || ''}
              searchLabel={`Search ${groupKey === 'usa-states' ? 'states' : 'counties'} in ${country.label}`}
              placeholder={`Search ${groupKey === 'usa-states' ? 'states' : 'counties'} in ${country.label}`}
            />
          </div>
        </div>
      )}

    </section>
  );
}
