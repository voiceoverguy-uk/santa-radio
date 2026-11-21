// Group display choices without changing the recording IDs used for rendering.
const key = label => label.toLowerCase().replace(/[^a-z0-9]/g, '');
export function groupWorkshopActivities(records) {
  const sports = new Set(records.filter(item => item.activityGroup === 'more-sports').map(item => key(item.label)));
  for (const label of ['Archery', 'Paddle Boarding']) sports.add(key(label));
  const grouped = records.map(item => sports.has(key(item.label))
    ? { ...item, activityGroup: 'more-sports' } : item);
  return grouped;
}
export function uniqueWorkshopActivities(records, selectedId) {
  const choices = new Map();
  for (const item of records) {
    const identity = key(item.label);
    if (!choices.has(identity) || item.id === selectedId) choices.set(identity, item);
  }
  return [...choices.values()];
}
