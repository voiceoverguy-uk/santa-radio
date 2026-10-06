// Keep the original import intact: historical URLs and alternative photographs
// remain recoverable. Only reviewed identities share a public profile.
export const identityAliases = {
  'brendan-o-carroll-mrs-brown': 'brendan-o-carroll-actor-mrs-brown',
  'mrs-brown-brendan-o-carroll': 'brendan-o-carroll-actor-mrs-brown',
  'brian-connelly-comedian': 'brian-conley-comedian',
  'calun-best-presenter': 'calum-best-presenter',
  'charlie-brookes-actress': 'charlie-brooks-actress',
  'chris-rodgers-bbc-newsreader': 'chris-rogers-bbc-newsreader',
  'dan-wallker-bbc-breakfast': 'dan-walker-bbc-breakfast',
  'david-badiel': 'david-baddiel-comedian',
  'eamon-holmes': 'eamonn-holmes-tv-personailty',
  'joanne-cliffton-dancer': 'joanne-clifton-dancer',
  'jack-caroll-bgt': 'jack-carroll-bgt',
  'jason-tindal-footballer': 'jason-tindall-footballer',
  'julian-cailon-dancer': 'julian-caillon-dancer',
  'received_1332680933541463': 'juliet-mills-actress',
  'received_582287048915178': 'maxwell-caulfield-actor',
  'kier-starmer-prime-minister': 'keir-starmer-prime-minister',
  'lucy-millburn-the-voice-uk': 'lucy-milburn-singer',
  'pep-guardiola-man-city-manaager': 'pep-guardiola-man-city-manager',
  'phil-jupitas-comedian': 'phill-jupitus-comedian',
  'scott-parker-fullham-manager': 'scott-parker-football-manager',
  'shaun-walsh-comedian': 'seann-walsh-comedian',
  'steve-mclaren-ex-england-football-manager': 'steve-mcclaren-ex-england-football-manager',
  'susan-coleman-comedian': 'susan-calman-comedian',
  'tom-dailey-olympic-diver': 'tom-daley-olympic-diver',
  'chris-taylor-on-the-right-and-jordan-hames-love-island-2': 'chris-taylor-on-the-right-and-jordan-hames-love-island',
};

export const normalizeName = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function buildCatalogue(raw) {
  const groups = new Map();
  const bySlug = new Map(raw.map(m => [m.song, m]));
  for (const m of raw) {
    const target = identityAliases[m.song];
    if (target && !bySlug.has(target)) throw new Error(`Missing canonical Mugshot: ${target}`);
    const name = normalizeName((bySlug.get(target) || m).artist);
    const group = groups.get(name) || [];
    group.push(m);
    groups.set(name, group);
  }
  const aliases = {}, conflicts = [];
  const catalogue = [...groups.values()].map(group => {
    const ranked = [...group].sort((a, b) =>
      Number(Boolean(identityAliases[a.song])) - Number(Boolean(identityAliases[b.song])) ||
      Number(Boolean(b.image)) - Number(Boolean(a.image)) ||
      Number(Boolean(b.info)) - Number(Boolean(a.info)));
    const canonical = { ...ranked[0] };
    for (const field of ['info', 'link', 'credit', 'socialUrl', 'image']) {
      if (!canonical[field]) canonical[field] = ranked.find(m => m[field])?.[field] || '';
    }
    const bios = [...new Set(group.map(m => m.info).filter(Boolean))];
    if (bios.length > 1) conflicts.push({ slug: canonical.song, reason: 'Conflicting biographies: retained primary text; review alternatives in raw catalogue.' });
    canonical.searchNames = [...new Set(group.map(m => m.artist))];
    for (const m of group) aliases[m.song] = canonical.song;
    return canonical;
  }).sort((a, b) => a.artist.localeCompare(b.artist, 'en'));
  return { catalogue, aliases, conflicts };
}
