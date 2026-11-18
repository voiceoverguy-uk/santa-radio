// Search taxonomy is separate from the public role caption. A profile may belong
// to several categories. Infer only from role text; biographies are not keywords
// because they also mention colleagues, programmes and unrelated careers.
export const normalizeCategoryText = value => String(value || '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[’']/g, '').replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim();

export const mugshotCategories = [
  { id: 'sport', label: 'Sport', aliases: ['sports', 'sporting'], role: /\bsports?\b/ },
  { id: 'football', label: 'Football', parent: 'sport', aliases: ['footballer', 'footballers', 'soccer', 'football manager', 'football managers'], role: /football|premier league|man city manager/ },
  { id: 'boxing', label: 'Boxing', parent: 'sport', aliases: ['boxer', 'boxers'], role: /box(?:ing|er)/ },
  { id: 'snooker', label: 'Snooker', parent: 'sport', aliases: ['snooker player', 'snooker players'], role: /snooker/ },
  { id: 'rugby', label: 'Rugby', parent: 'sport', aliases: ['rugby player', 'rugby players'], role: /rugby/ },
  { id: 'cricket', label: 'Cricket', parent: 'sport', aliases: ['cricketer', 'cricketers'], role: /cricket/ },
  { id: 'golf', label: 'Golf', parent: 'sport', aliases: ['golfer', 'golfers'], role: /golf/ },
  { id: 'tennis', label: 'Tennis', parent: 'sport', aliases: ['tennis player'], role: /tennis/ },
  { id: 'swimming', label: 'Swimming & Diving', parent: 'sport', aliases: ['swimming', 'swimmer', 'swimmers', 'diving', 'diver', 'divers'], role: /swimm|\bdiver\b/ },
  { id: 'athletics', label: 'Athletics', parent: 'sport', aliases: ['athlete', 'athletes', 'olympian', 'olympians', 'olympics', 'paralympics'], role: /athlete|olympian/ },
  { id: 'music', label: 'Music', aliases: ['musical', 'musicians', 'musician'], role: /sing|musician|\bband\b|pop (?:duo|group)|songwriter|record producer|tenor|soprano|\bdj\b/ },
  { id: 'comedy', label: 'Comedy', aliases: ['comedian', 'comedians', 'comic', 'comics', 'stand up', 'standup', 'impressionist', 'impressionists'], role: /comedi|comedy|comic\b|impressionist/ },
  { id: 'tv-film', label: 'TV & Film', aliases: ['tv', 'television', 'film', 'films', 'cinema', 'movie', 'movies'], role: /\btv\b|television|actor|actress|film|reality|quizzer|gladiator/ },
  { id: 'acting', label: 'Actors & Actresses', parent: 'tv-film', aliases: ['actor', 'actors', 'actress', 'actresses', 'acting'], role: /actor|actress/ },
  { id: 'radio', label: 'Radio', aliases: ['radio presenter', 'radio presenters', 'radio dj', 'radio djs'], role: /radio/ },
  { id: 'dance', label: 'Dance', aliases: ['dance', 'dancer', 'dancers', 'dancing', 'ballroom', 'ballet', 'choreography'], role: /danc|ballerina|choreograph/ },
  { id: 'food', label: 'Food & Cooking', aliases: ['food', 'cooking', 'chef', 'chefs', 'cook', 'cooks', 'baking', 'baker'], role: /chef|\bcook\b|baker/ },
  { id: 'writing', label: 'Writing & Journalism', aliases: ['writing', 'writer', 'writers', 'author', 'authors', 'journalism', 'journalist', 'journalists', 'news', 'newsreader'], role: /author|journalist|\bwriter\b|news\s?reader|reporter|correspondent/ },
  { id: 'politics', label: 'Politics', aliases: ['politician', 'politicians', 'mp', 'parliament'], role: /politician|\bmp\b|parliament|prime minister/ },
  { id: 'business', label: 'Business', aliases: ['entrepreneur', 'entrepreneurs', 'businessperson'], role: /entrepreneur|businessperson|promoter/ },
  { id: 'science', label: 'Science & Space', aliases: ['science', 'space', 'astronaut', 'astronauts'], role: /astronaut|scientist/ },
  { id: 'characters', label: 'Characters & Mascots', aliases: ['character', 'characters', 'mascot', 'mascots', 'superhero'], role: /character|mascot|superhero|mechanical actor|cbbc tv dog|father christmas/ },
  { id: 'online', label: 'Online Creators', aliases: ['online', 'creator', 'creators', 'youtube', 'youtuber', 'streamer', 'podcast', 'podcaster', 'vlogger'], role: /you\s?tuber|streamer|podcast|vlogger/ },
  { id: 'entertainment', label: 'Entertainment', aliases: ['entertainer', 'entertainers', 'magic', 'magician', 'drag'], role: /entertain|magician|drag queen|presenter|broadcaster|personality|model/ },
];
export function profileCategories(profile, extra = []) {
  const ids = new Set([...(profile.categories || []), ...extra]);
  const role = normalizeCategoryText(profile.link);
  for (const category of mugshotCategories) if (category.role.test(role)) ids.add(category.id);
  for (const id of [...ids]) {
    const category = mugshotCategories.find(item => item.id === id);
    if (!category) throw new Error(`Unknown mugshot category: ${id}`);
    if (category.parent) ids.add(category.parent);
  }
  return [...ids];
}
export function matchingCategories(query, partial = false) {
  const q = normalizeCategoryText(query);
  if (!q) return [];
  return mugshotCategories.filter(category => [category.label, ...category.aliases].some(term => {
    const normalized = normalizeCategoryText(term);
    return partial ? normalized.startsWith(q) : normalized === q;
  }));
}
