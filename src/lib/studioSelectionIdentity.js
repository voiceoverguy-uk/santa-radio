// Recorded choices only: written spelling and letter variation are display-only.
// The request omits an unselected region while the picker uses an empty string.
export function studioSelectionIdentity(choices) {
  const talent = choices.talent;
  return JSON.stringify([
    choices.name,
    ...['age', 'activity', 'achievement', 'treat', 'place'].map(key => choices[key]),
    choices.region === undefined ? '' : choices.region,
    talent?.skip === true ? ['skip'] : ['selected', talent?.category, talent?.id],
  ]);
}
