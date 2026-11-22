import assert from 'node:assert/strict';
import test from 'node:test';
import { questionWording } from '../src/christmas-game/question-wording.js';
import { films } from '../src/christmas-game/films.js';
import { isAmbiguousTitle, matchesTitle, MAX_QUESTIONS, nextTurn } from '../src/christmas-game/engine.js';

function playRound(respond, questionOrder) {
  const history = [];
  let turn = nextTurn(history, questionOrder);
  while (turn.question) {
    assert.ok(history.length < MAX_QUESTIONS, 'The game asked a question after the limit');
    assert.ok(!history.some(entry => entry.question.id === turn.question.id), 'The game repeated a question');
    history.push({ question: turn.question, answer: respond(turn.question) });
    turn = nextTurn(history, questionOrder);
  }
  return { count: history.length, guess: turn.guess };
}

test('Santa can identify every catalogue entry within 20 questions using its recorded traits', () => {
  for (const [index, film] of films.entries()) {
    for (const seed of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const { guess } = playRound(question => question.responses[index], { seed });
      assert.equal(guess, film, `${film.title} (${film.year}), seed ${seed}`);
    }
  }
});

test('Santa runs out of questions and concedes when the player cannot answer any', () => {
  assert.deepEqual(playRound(() => null), { count: 20, guess: null });
});

test('Sealed titles support aliases and distinguish films with identical titles by year', () => {
  assert.equal(isAmbiguousTitle('Miracle on 34th Street'), true);
  assert.equal(isAmbiguousTitle('Miracle on 34th Street (1994)'), false);
  const remake = films.find(film => film.title === 'Miracle on 34th Street' && film.year === 1994);
  assert.equal(matchesTitle(remake, 'Miracle on 34th Street (1994)'), true);
  assert.equal(matchesTitle(remake, 'Miracle on 34th Street (1947)'), false);
  const evergreen = films.find(film => film.title.endsWith('Tidings of Joy'));
  assert.equal(matchesTitle(evergreen, 'tidings of joy'), true);
});

test('Santa varies his opening and avoids an opener used in the previous round', () => {
  const openings = Array.from({ length: 8 }, (_, seed) => nextTurn([], { seed }).question.id);
  assert.ok(new Set(openings).size >= 6);
  assert.ok(Array.from({ length: 8 }, (_, seed) => nextTurn([], { seed }).question.story).every(Boolean));
  const next = nextTurn([], { seed: 0, recentOpeners: [openings[0]] }).question.id;
  assert.notEqual(next, openings[0]);
});

test('Typing grinch gives Santa the point for The Grinch (2018)', () => {
  const grinch = films.find(film => film.title === 'The Grinch' && film.year === 2018);
  assert.equal(isAmbiguousTitle('grinch'), false);
  assert.equal(matchesTitle(grinch, '  grinch  '), true);
  assert.equal(matchesTitle(grinch, 'Grinch (2000)'), false);
});

test('A recurring question can change wording while keeping the same clue', () => {
  const question = nextTurn([], { seed: 0 }).question;
  const original = questionWording(question, 0);
  assert.equal(original, question.text);
  assert.notEqual(questionWording(question, 1), original);
  assert.equal(questionWording(question, 2), original);
});
