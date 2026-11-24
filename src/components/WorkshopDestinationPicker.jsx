import { useLayoutEffect, useMemo, useRef, useState } from 'react';
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
  const [openGroup, setOpenGroup] = useState(null);
  const picker = useRef(null);
  const focusNext = useRef(false);
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
  const regionalView = canChooseRegion && openGroup === groupKey;
  const selectedDestination = selectedRegion ? `${selectedRegion.label}, ${country.label}` : country?.label;
  const switchView = group => {
    focusNext.current = true;
    setOpenGroup(group);
  };
  useLayoutEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    const target = picker.current?.querySelector('[role="listbox"]') || picker.current?.querySelector('input[type="search"]');
    target?.focus({ preventScroll: true });
  }, [regionalView]);

  return (
    <section ref={picker} className="smw-destination-picker" aria-label="Destination">
      <div className="smw-talent-categories" role="group" aria-label="Choose a destination category">
        {[
          ['countries', 'Countries & real places'],
          ['fantasy', 'Fantasy & space'],
        ].map(([key, label]) => (
          <button key={key} type="button" className={category === key ? 'is-selected' : ''}
            aria-pressed={category === key} onClick={() => {
              setOpenGroup(null);
              if (category !== key) onCategoryChange?.(key);
            }}>{label}</button>
        ))}
      </div>
      <div className={regionalView ? "smw-destination-picker__regional" : "smw-destination-picker__country"}>
        <div className="smw-destination-picker__searchable">
          <WorkshopSearchableChoices
            key={regionalView ? groupKey : category}
            category="place"
            label={regionalView ? regionalHeadings[groupKey] : fantasy ? 'Fantasy & space' : 'Countries & real places'}
            options={regionalView ? availableRegions : visibleOptions}
            value={regionalView ? region : value}
            onChange={regionalView ? id => onRegionChange?.(String(id)) : onChange}
            invalid={!regionalView && invalid}
            onTick={onTick}
            onSoundInteraction={onSoundInteraction}
            wording={wording}
            searchLabel={regionalView ? `Search ${regionPlural} in ${country.label}` : fantasy ? 'Search fantasy and space destinations' : 'Search locations'}
            placeholder={regionalView ? `Search ${regionPlural} in ${country.label}` : fantasy ? 'Try a fantasy place or space destination' : 'Search countries and real places'}
            selectedText={selectedRegion?.label || country?.label || ''}
            selectionStatusLabel={selectedDestination}
            fallbackSelectionLabel={regionalView ? country.label : undefined}
            frameActionAtTop={regionalView}
            frameAction={regionalView ? (
              <button type="button" onClick={() => switchView(null)}>‹ {country.label}</button>
            ) : canChooseRegion && (
              <button className={selectedRegion ? undefined : "smw-destination-picker__choose-region"} type="button" onClick={() => switchView(groupKey)}>
                {selectedRegion ? 'Change' : 'Choose a'} {regionKind} <span aria-hidden="true">›</span>
              </button>
            )}
            wheelFooter={regionalView && selectedRegion && (
              <button type="button" className="smw-destination-picker__country-only" onClick={() => {
                onRegionChange?.('');
                switchView(null);
              }}>Use {country.label} only</button>
            )}
            afterWheel={!regionalView && guidance && <p className="smw-destination-picker__region-prompt">{guidance}</p>}
          />
        </div>
      </div>
    </section>
  );
}
