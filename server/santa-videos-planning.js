// Planning exposes choice labels only, never recordings, storage paths or prose.
export function planningCatalogue(catalogue) {
  const clean = record => Object.fromEntries(['id', 'label', 'number', 'unit', 'kind', 'activityGroup']
    .filter(key => record[key] !== undefined).map(key => [key, record[key]]));
  return {
    categories: Object.fromEntries(['age', 'sports', 'funny', 'activity', 'achievement', 'treat', 'place']
      .map(key => [key, (catalogue.categories[key] || []).map(clean)])),
    regionalGroups: Object.values(catalogue.regionalGroups || {}).filter(group => group.parentId)
      .map(group => ({ parentId: group.parentId, records: group.records.map(clean) })),
  };
}
