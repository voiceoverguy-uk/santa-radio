import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { OPENING_GROUPS, FUN_GROUPS } from '../src/naughty-or-nice/checkerQuestions.js';
import { selectQuestionRound, classifyAnswers, ROUND_QUESTION_COUNT } from '../src/naughty-or-nice/checkerLogic.js';

const groups = [...OPENING_GROUPS, ...FUN_GROUPS];
const bank = groups.flatMap(group => group.questions);
function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

test('all ten positive questions must be answered; exactly six No changes the result', () => {
  assert.equal(ROUND_QUESTION_COUNT, 10);
  for (let no = 0; no <= 10; no++) {
    const answers = Array.from({ length: ROUND_QUESTION_COUNT }, (_, index) => index < no ? 'no' : 'yes');
    assert.equal(classifyAnswers(answers), no >= 6 ? 'naughty' : 'nice');
  }
  for (const invalid of [null, undefined, 'yes', {}, [], Array(10), Array(10).fill(''),
    Array(9).fill('no'), Array(11).fill('yes'), Array(10).fill('maybe'),
    [...Array(9).fill('yes'), ''], [...Array(9).fill('yes'), null],
    [...Array(9).fill('yes'), true], [...Array(9).fill('yes'), 'Yes']])
    assert.equal(classifyAnswers(invalid), null);
  const sparse = Array(10).fill('no');
  delete sparse[9];
  assert.equal(classifyAnswers(sparse), null);
});

async function suppliedGroups(path, names) {
  const lines = (await readFile(path, 'utf8')).split(/\r?\n/);
  return names.map(name => {
    const start = lines.indexOf(name);
    assert.ok(start >= 0, `Missing supplied category: ${name}`);
    const questions = [];
    for (const line of lines.slice(start + 1)) {
      if (!/^\d+\. /.test(line)) break;
      questions.push(line.replace(/^\d+\. /, ''));
    }
    const expectedCount = { 'Being kind': 4, 'Helping others': 3, 'Trying hard': 3 }[name] ?? 10;
    assert.equal(questions.length, expectedCount, name);
    return { name, questions };
  });
}

test('the bank is the duplicate-free union of both supplied batches with openings unchanged', async () => {
  const original = await suppliedGroups(
    'attached_assets/Pasted-10-questions-for-Q1-Q3-Draw-one-from-each-group-so-the-_1793986075511.txt',
    groups.map(group => group.name));
  const additions = await suppliedGroups(
    'attached_assets/Pasted-Add-these-to-the-existing-50-fun-questions-skipping-any_1794236373718.txt',
    FUN_GROUPS.map(group => group.name));
  assert.deepEqual(OPENING_GROUPS, original.slice(0, 3));
  assert.deepEqual(OPENING_GROUPS.map(group => group.questions.length), [4, 3, 3]);
  assert.deepEqual(FUN_GROUPS.map(group => group.questions.length), [20, 20, 20, 20, 20]);
  assert.equal(bank.length, 110);
  assert.equal(new Set(bank).size, bank.length, 'No duplicate questions across any categories');
  FUN_GROUPS.forEach((group, index) => {
    const expected = new Set([...original[index + 3].questions, ...additions[index].questions]);
    assert.deepEqual(new Set(group.questions), expected, group.name);
    for (const question of additions[index].questions)
      assert.equal(group.questions.filter(value => value === question).length, 1, question);
  });
});

test('seeded selection covers every group without repeats and never mutates the bank', () => {
  const before = structuredClone(groups);
  const draws = new Set();
  const seen = new Set();
  const extraPairs = new Set();
  const funFirstGroups = new Set();
  for (let seed = 0; seed < 1000; seed++) {
    const spreadSeed = Math.imul(seed, 2654435761) >>> 0;
    const round = selectQuestionRound(seeded(spreadSeed));
    assert.deepEqual(round, selectQuestionRound(seeded(spreadSeed)));
    assert.equal(round.length, ROUND_QUESTION_COUNT);
    assert.equal(new Set(round).size, ROUND_QUESTION_COUNT);
    OPENING_GROUPS.forEach((group, index) => assert.ok(group.questions.includes(round[index])));
    const counts = FUN_GROUPS.map(group => round.slice(3).filter(question => group.questions.includes(question)).length);
    assert.deepEqual([...counts].sort(), [1, 1, 1, 2, 2]);
    extraPairs.add(counts.map((count, index) => count === 2 ? index : '').join(','));
    funFirstGroups.add(FUN_GROUPS.findIndex(group => group.questions.includes(round[3])));
    round.forEach(question => seen.add(question));
    draws.add(JSON.stringify(round));
  }
  assert.deepEqual(seen, new Set(bank));
  assert.equal(extraPairs.size, 10);
  assert.equal(funFirstGroups.size, 5);
  assert.ok(draws.size > 950);
  assert.deepEqual(groups, before);
  assert.notDeepEqual(selectQuestionRound(() => 0), selectQuestionRound(() => .999999));
});

test('edge random draws still give seven distinct fun questions covering all five categories', () => {
  for (const value of [0, .5, .999999]) {
    const round = selectQuestionRound(() => value);
    assert.equal(round.length, 10);
    assert.equal(new Set(round).size, 10);
    OPENING_GROUPS.forEach((group, index) => assert.ok(group.questions.includes(round[index])));
    const counts = FUN_GROUPS.map(group => round.slice(3).filter(question => group.questions.includes(question)).length);
    assert.deepEqual(counts.sort(), [1, 1, 1, 2, 2]);
  }
});
