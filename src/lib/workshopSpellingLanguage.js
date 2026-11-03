export const WORKSHOP_LANGUAGE_ERROR = 'Bad language is not allowed. Remove it before creating your images.';

// Match offensive words and common forms, not arbitrary substrings of names
// such as Ishita, Scunthorpe, Hancock, Dick or Fanny.
const offensiveWord = /^(?:[a-z]*fuck[a-z]*|bullshit|horseshit|shit(?:s|ty|ting|ted|head[s]?|face[s]?|hole[s]?)?|cunt[s]?|wank(?:s|er[s]?|ing|ed)?|twat[s]?|boll?ock[s]?|arse(?:hole[s]?)?|ass(?:hole[s]?)?|bastard[s]?|bitch(?:es|y|ing)?|dickhead[s]?|cock(?:s|sucker[s]?)?|prick[s]?|piss(?:ed|ing|off)?|bugger[s]?|slut[s]?|whore[s]?|tosser[s]?|knobhead[s]?|bellend[s]?|damn(?:ed)?|bloody|fagg?ot[s]?|nigger[s]?)$/;
const substitutions = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's' };

export function containsWorkshopProfanity(value) {
  const normalised = String(value).normalize('NFKD').toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/\p{Cf}/gu, '')
    .replace(/[013457@$]/g, character => substitutions[character]);
  const tokens = normalised.match(/\p{L}+/gu) || [];
  const matches = word => offensiveWord.test(word)
    || offensiveWord.test(word.replace(/(.)\1+/g, '$1'));
  // Also detect punctuation/space-separated spellings such as f-u-c-k.
  for (let start = 0; start < tokens.length; start++) {
    let joined = '';
    for (let end = start; end < tokens.length; end++) {
      joined += tokens[end];
      if (matches(joined)) return true;
      if (joined.length >= 32) break;
    }
  }
  return false;
}
