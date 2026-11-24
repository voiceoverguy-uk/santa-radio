import { useMemo, useRef } from 'react';
import WorkshopSearchableChoices from './WorkshopSearchableChoices.jsx';
import { workshopRegionalFolders, workshopDestinationCategory, workshopDestinationLabel } from '../lib/workshopDestinations.js';
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
  category = 'countries',
  onCategoryChange,
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
  const regionHeadingRef = useRef(null);
  const fantasy = category === 'fantasy';
  const visibleOptions = options.filter(option => workshopDestinationCategory(option) === category)
    .map(option => ({ ...option, label: workshopDestinationLabel(option.label) }));
  const country = visibleOptions.find(option => String(option.id) === String(value));
  const groupKey = !fantasy && regionalFiles[country?.file];
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

  const regionKind = groupKey === 'usa-states' ? 'state' : 'county';
  const regionPlural = regionKind === 'state' ? 'states' : 'counties';
  const useCountryOnly = () => {
    onRegionChange?.('');
    regionHeadingRef.current?.focus({ preventScroll: true });
  };
  const regionSection = canChooseRegion && (
    <section key={groupKey} className="smw-destination-picker__regional" aria-label={regionalHeadings[groupKey]}>
      <h3 ref={regionHeadingRef} tabIndex={-1} className="smw-destination-picker__heading">
        Choose a {regionKind} <span>(optional)</span>
      </h3>
      <p className="smw-destination-picker__regional-note">
        Make their message more local, or leave this unselected to use {country.label} only.
      </p>
      <WorkshopSearchableChoices
        key={groupKey} category="place" label={regionalHeadings[groupKey]}
        options={availableRegions} value={region}
        onChange={id => onRegionChange?.(String(id))}
        onTick={onTick} onSoundInteraction={onSoundInteraction}
        showWordingPreview={false}
        selectionStatusLabel={selectedRegion ? `${selectedRegion.label}, ${country.label}` : ''}
        searchLabel={`Search ${regionPlural} in ${country.label}`}
        placeholder={`Search ${regionPlural} in ${country.label}`}
        wheelFooter={selectedRegion && (
          <div className="smw-destination-picker__regional-actions">
            <button className="smw-destination-picker__country-only" type="button" onClick={useCountryOnly}>
              Use {country.label} only
            </button>
          </div>
        )}
      />
    </section>
  );

  return (
    <section className="smw-destination-picker" aria-label="Destination">
      <div className="smw-talent-categories" role="group" aria-label="Choose a destination category">
        {[
          ['countries', 'Countries & real places'],
          ['fantasy', 'Fantasy & space'],
        ].map(([key, label]) => (
          <button key={key} type="button" className={category === key ? 'is-selected' : ''}
            aria-pressed={category === key} onClick={() => {
              if (category !== key) onCategoryChange?.(key);
            }}>{label}</button>
        ))}
      </div>
      <div className="smw-destination-picker__country">
        <h3 tabIndex={-1}
          className="smw-destination-picker__heading smw-destination-picker__heading--accessible-only">
          {fantasy ? 'Choose a fantasy or space destination' : 'Choose a country or real place'}
        </h3>
        <div className="smw-destination-picker__searchable">
          <WorkshopSearchableChoices
            key={category}
            category="place"
            label={fantasy ? 'Fantasy & space' : 'Countries & real places'}
            options={visibleOptions}
            value={value}
            onChange={onChange}
            invalid={invalid}
            onTick={onTick}
            onSoundInteraction={onSoundInteraction}
            wording={wording}
            searchLabel={fantasy ? 'Search fantasy and space destinations' : 'Search locations'}
            placeholder={fantasy ? 'Try a fantasy place or space destination' : 'Search countries and real places'}
            selectedText={selectedRegion?.label || country?.label || ''}
            afterWheel={regionSection || (guidance && <div className="smw-destination-picker__region-prompt">
              <p>{guidance}</p>
            </div>)}
          />
        </div>
      </div>


    </section>
  );
}
