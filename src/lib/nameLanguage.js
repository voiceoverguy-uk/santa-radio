export const BLOCKED_NAME_NOTE = "We won't find that spelling. Let's not use that word! It's Christmas.";

// Match complete words, never fragments of names such as Scunthorpe or Fuchsia.
// Deliberately omit ambiguous genuine names (for example Dick and Fanny).
const blockedWords = new Set([
  'fuck', 'fucks', 'fucker', 'fuckers', 'fucking', 'fucked', 'fuckhead', 'fuckoff',
  'motherfucker', 'motherfuckers', 'motherfucking',
  'shit', 'shits', 'shite', 'shitty', 'shitting', 'shithead', 'bullshit',
  'cunt', 'cunts', 'bitch', 'bitches', 'bastard', 'bastards',
  'wank', 'wanker', 'wankers', 'wanking', 'twat', 'twats', 'bollocks',
  'cock', 'cocks', 'dickhead', 'dickheads', 'prick', 'pricks',
  'arsehole', 'arseholes', 'asshole', 'assholes', 'piss', 'pissed', 'pissing',
]);
const longestBlockedWord = Math.max(...[...blockedWords].map(word => word.length));

// Common visual substitutions only; this is not a multilingual word filter.
const lookalikes = {
  'а': 'a', 'ɑ': 'a', 'α': 'a', 'с': 'c', 'ϲ': 'c', 'е': 'e', 'ε': 'e',
  'і': 'i', 'ι': 'i', 'ӏ': 'i', 'к': 'k', 'κ': 'k', 'о': 'o', 'ο': 'o',
  'р': 'p', 'ρ': 'p', 'ѕ': 's', 'т': 't', 'τ': 't', 'υ': 'u', 'х': 'x',
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't',
  '@': 'a', '$': 's', '!': 'i', '|': 'i',
};

export function isBlockedName(value) {
  if (typeof value !== 'string') return false;
  const normalised = value.normalize('NFKD').toLowerCase()
    .replace(/[\p{M}\p{Cf}]/gu, '')
    .replace(/[^\x00-\x7f]|[013457@$!|]/gu, char => lookalikes[char] || char);
  const words = normalised.match(/[\p{L}\p{N}]+/gu) || [];
  // Joining adjacent whole tokens catches f.u.c.k, s-h-i-t and similar
  // separator disguises, including a disguised word within a longer phrase.
  for (let start = 0; start < words.length; start++) {
    let joined = '';
    for (let end = start; end < words.length; end++) {
      joined += words[end];
      if (joined.length > longestBlockedWord) break;
      if (blockedWords.has(joined)) return true;
    }
  }
  return false;
}
