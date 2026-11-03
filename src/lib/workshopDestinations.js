// Fixed parent relationships, not a recording inventory. Only indexed files
// become selectable; neither labels nor browser-supplied paths establish trust.
export const workshopRegionalFolders = {
  'usa-states': 'countries/united-states.wav',
  'england-counties': 'countries/england.wav',
  'scotland-counties': 'countries/scotland.wav',
  'wales-counties': 'countries/wales.wav',
  'northern-ireland-counties': 'countries/northern-ireland.wav',
};

// Classifications come from the verified catalogue, never display labels or
// filenames. Older catalogues without kind contain ordinary places.
export function workshopDestinationCategory(record) {
  return record?.kind === 'fantasy' || record?.kind === 'space' ? 'fantasy' : 'countries';
}

// Presentation only: retain catalogue IDs, classifications and recording paths.
export function workshopDestinationLabel(label = '') {
  return label.replace(/ — (?:Fantasy place|Space destination)$/i, '');
}

export function selectedWorkshopRegion(catalogue, countryId, regionId) {
  if (!regionId) return null;
  const group = Object.values(catalogue?.regionalGroups || {}).find(group => group.parentId === countryId);
  return group?.records.find(record => record.id === regionId) || null;
}
