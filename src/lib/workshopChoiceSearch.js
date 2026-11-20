const normalize = text => String(text || '').normalize('NFD').replace(/\p{M}/gu, '')
  .toLocaleLowerCase('en-GB').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function workshopSearchTerms(query) {
  return normalize(query).split(/\s+/).filter(Boolean);
}

export function filterWorkshopChoices(options, query, getOptionLabel) {
  const terms = workshopSearchTerms(query);
  if (!terms.length) return options;
  return options.filter(option => {
    const label = normalize(getOptionLabel ? `${option.label} ${getOptionLabel(option.label)}` : option.label);
    return terms.every(term => label.includes(term));
  });
}
