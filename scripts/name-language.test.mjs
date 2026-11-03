import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedName, BLOCKED_NAME_NOTE } from '../src/lib/nameLanguage.js';

export const abusiveNames = [
  'fuck', 'SHIT', 'cunt', 'bitch', 'wanker', 'twat', 'bastard', 'bollocks',
  'asshole', 'arsehole', 'motherfucker', 'fucking', 'bullshit', 'wank', 'shite',
  'cock', 'dickhead', 'prick',
  'ＦＵＣＫ', 'fúçk', 'fu\u200bck', 'fu\u2060ck', 'f.u.c.k', 'f u c k',
  's-h-i-t', "c'u'n’t", 'f_u_c_k', 'sh1t', '$hit', 'fυсk', 'fuсk',
  'fuck you', 'Mary shit', 'f.u.c.k you',
];
export const innocentNames = [
  'Arabella', 'Erin', 'Scunthorpe', 'Fuchsia', 'Dick', 'Dickson', 'Fanny',
  'Cassian', 'Cassidy', 'Bastian', 'Ashita', 'Shital', 'Titus', 'Kum',
  'Élodie', 'E\u0301lodie', 'Anne-Marie', 'O’Neil', "D'Arcy", '李明',
  'UnknownName', 'Fu', 'Shi', 'Sh', '',
];

test('clear swear words and common disguises are rejected as complete words', () => {
  for (const name of abusiveNames) assert.equal(isBlockedName(name), true, name);
  assert.equal(BLOCKED_NAME_NOTE, "We won't find that spelling. Let's not use that word! It's Christmas.");
});

test('genuine names and innocent coincidental sequences are not substring-blocked', () => {
  for (const name of innocentNames) assert.equal(isBlockedName(name), false, name);
});
