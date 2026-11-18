import { matchingCategories, profileCategories, normalizeCategoryText } from './mugshot-categories.js';
// Search published profiles through names, curated aliases, roles and categories.
export const normalizeSearch = value => normalizeCategoryText(value);
const namesOf = profile => [...new Set([profile.artist, ...(profile.searchNames || []), ...(profile.searchAliases || [])])];

// These are spelling/number variants, not additional talent classifications.
const families = [
  { id: 'dance', label: 'Dance / Dancer', pattern: /\bdanc(?:e|er)s?\b/i, queries: ['dance', 'dances', 'dancer', 'dancers'] },
  { id: 'singer', label: 'Singer / Singers', pattern: /\bsingers?\b/i, queries: ['singer', 'singers'] },
];

function matchingFamily(query) {
  return families.find(family => family.queries.includes(query));
}

export function matchesMugshot(profile, query, selection = null) {
  if (selection?.type === 'category') return profileCategories(profile).includes(selection.category);
  if (selection?.type === 'name') return profile.song === selection.slug;
  if (selection?.type === 'talent') {
    const family = families.find(item => item.id === selection.family);
    return family ? (family.id === 'dance' ? profileCategories(profile).includes('dance') : family.pattern.test(profile.link)) :
      normalizeSearch(profile.link).includes(selection.query);
  }
  const q = normalizeSearch(query);
  if (!q) return true;
  return namesOf(profile).some(name => normalizeSearch(name).includes(q)) ||
    normalizeSearch(profile.link).includes(q) ||
    matchingCategories(q).some(category => profileCategories(profile).includes(category.id)) ||
    Boolean(matchingFamily(q)?.pattern.test(profile.link));
}

const rank = (text, query) => text === query ? 0 : text.startsWith(query) ? 1 : 2;
const compare = (a, b) => a.rank - b.rank || a.label.localeCompare(b.label, 'en', { sensitivity: 'base' });

export function mugshotSuggestions(catalogue, query) {
  const q = normalizeSearch(query);
  if (!q) return [];
  const names = catalogue.flatMap(profile => {
    const matches = namesOf(profile).map(normalizeSearch).filter(name => name.includes(q));
    return matches.length ? [{
      id: `name-${profile.song}`, type: 'name', slug: profile.song, label: profile.artist,
      homepage: profile.homepage === true,
      rank: Math.min(...matches.map(name => rank(name, q))),
    }] : [];
  }).sort((a, b) => Number(b.homepage) - Number(a.homepage) || compare(a, b));
  const familyMatches = families.filter(family =>
    (normalizeSearch(family.label).includes(q) || family.queries.includes(q)) &&
    catalogue.some(profile => family.pattern.test(profile.link)));
  const talents = familyMatches.map(family => ({
    id: `talent-${family.id}`, type: 'talent', family: family.id, label: family.label, rank: 0,
  }));
  const seen = new Set();
  for (const profile of catalogue) {
    const label = profile.link.trim();
    const normalized = normalizeSearch(label);
    if (!normalized.includes(q) || !normalized || seen.has(normalized) ||
      familyMatches.some(family => family.pattern.test(label))) continue;
    seen.add(normalized);
    talents.push({ id: `talent-${encodeURIComponent(normalized)}`, type: 'talent', query: normalized, label, rank: rank(normalized, q) });
  }
  // Reserve space for both kinds, even for a broad query with many names.
  const categoryOptions = matchingCategories(q, true)
    .filter(category => category.id !== 'dance' || !familyMatches.some(family => family.id === 'dance'))
    .map(category => ({ id: `category-${category.id}`, type: 'category', category: category.id, label: category.label,
      count: catalogue.filter(profile => profileCategories(profile).includes(category.id)).length }))
    .filter(category => category.count > 0)
    .sort((a, b) => Number(Boolean(matchingCategories(q).find(c => c.id === b.category))) -
      Number(Boolean(matchingCategories(q).find(c => c.id === a.category))));
  const chosenCategories = categoryOptions.slice(0, 2);
  const chosenTalents = talents.sort(compare).slice(0, 2 - chosenCategories.length);
  const chosenNames = [...new Map(names.map(item => [item.slug, item])).values()].slice(0, 8 - chosenTalents.length - chosenCategories.length);
  return [...chosenCategories, ...chosenNames, ...chosenTalents];
}
