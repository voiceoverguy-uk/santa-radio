import { categories, films } from './films.js';
import { plotQuestions } from './plot-questions.js';

export const MAX_QUESTIONS = 20;
const questionBank = [
  ...plotQuestions.map(([id, text, titles]) => ({
    id,
    text,
    story: true,
    responses: films.map(film => titles.includes(film.title) || titles.includes(`${film.title} (${film.year})`)),
  })),
  ...Object.entries(categories).filter(([id]) => id !== 'time' && id !== 'recent').map(([id, text]) => ({
    id,
    text,
    responses: films.map(film => film.traits.has(`?${id}`) ? null : film.traits.has(id)),
  })),
  ...films.map((film, index) => ({
    id: `plot-${index}`,
    text: film.clue,
    specific: true,
    responses: films.map((_, candidate) => candidate === index),
  })),
];

export function nextTurn(history, { seed = 0, recentOpeners = [] } = {}, { entries = films, questions = questionBank } = {}) {
  const asked = new Set(history.map(({ question }) => question.id));
  const weights = entries.map((_, index) => history.reduce((weight, { question, answer }) => {
    const expected = question.responses[index];
    if (answer === null || expected == null) return weight * 0.5;
    const accuracy = question.specific ? 0.995 : 0.9;
    return weight * (answer === expected ? accuracy : 1 - accuracy);
  }, 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const probabilities = weights.map(weight => weight / total);
  const leader = probabilities.indexOf(Math.max(...probabilities));
  const confirmedPlot = history.some(({ question, answer }) => question.specific && answer === true && question.responses[leader]);
  const confidence = probabilities[leader];

  if ((confirmedPlot && confidence >= 0.8) || history.length >= MAX_QUESTIONS) {
    return { guess: confidence >= 0.25 ? entries[leader] : null };
  }

  const ranked = [];
  for (const question of questions) {
    if (asked.has(question.id)) continue;
    let yes = 0;
    let no = 0;
    for (const [index, expected] of question.responses.entries()) {
      if (expected === true) yes += probabilities[index];
      if (expected === false) no += probabilities[index];
    }
    const score = 4 * yes * no + (question.specific && question.responses[leader] && confidence >= 0.55 ? 1 : 0);
    ranked.push({ question, score });
  }
  ranked.sort((left, right) => right.score - left.score);
  const storyQuestions = ranked.filter(({ question, score }) => question.story && score > 0.1);
  if (history.length === 0) {
    const fresh = storyQuestions.filter(({ question }) => !recentOpeners.includes(question.id));
    const pool = fresh.length ? fresh : storyQuestions.length ? storyQuestions : ranked.slice(0, 3);
    return { question: pool[seed % pool.length].question };
  }
  if (history.length === 1 && storyQuestions[0]?.score >= ranked[0].score * 0.35) {
    const pool = storyQuestions.slice(0, 4);
    return { question: pool[seed % pool.length].question };
  }
  const alternatives = ranked.filter(({ score, question }) =>
    score >= ranked[0].score * (history.length < 4 ? 0.85 : 0.95) &&
    (!question.specific || question === ranked[0].question),
  ).slice(0, 6);
  const choice = (seed + history.length * 7) % alternatives.length;
  return { question: alternatives[choice].question };
}

function normaliseTitle(value) {
  return value.normalize('NFKD').toLowerCase().trim().replace(/^the\s+/, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

export function matchesTitle(film, title) {
  const normalised = normaliseTitle(title);
  return [film.title, `${film.title} ${film.year}`, ...film.aliases].some(candidate =>
    normaliseTitle(candidate) === normalised,
  );
}

export function isAmbiguousTitle(title) {
  return films.filter(film => matchesTitle(film, title)).length > 1;
}

function titleKey(value) {
  return normaliseTitle(value.toLowerCase().replace(/\bxmas\b/g, 'christmas').replace(/\bst\.?$/g, 'street'));
}

function titleDistance(left, right) {
  let row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 0; i < left.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < right.length; j++) {
      next.push(Math.min(row[j + 1] + 1, next[j] + 1, row[j] + Number(left[i] !== right[j])));
    }
    row = next;
  }
  return row[right.length];
}

export function suggestFilms(title, entries = films) {
  const year = title.match(/\b((?:19|20)\d{2})\)?\s*$/);
  const query = titleKey(year ? title.slice(0, year.index) : title);
  if (query.length < 3) return [];
  const limit = Math.min(3, Math.floor(query.length / 4));
  let best = limit + 1;
  let choices = [];
  for (const film of entries) {
    if (year && film.year !== Number(year[1])) continue;
    for (const name of [film.title, ...film.aliases]) {
      const candidate = titleKey(name);
      if (Math.abs(query.length - candidate.length) > limit) continue;
      const distance = titleDistance(query, candidate);
      if (distance > limit || distance > best) continue;
      if (distance < best) choices = [];
      best = distance;
      if (!choices.includes(film)) choices.push(film);
    }
  }
  return choices.slice(0, 5);
}
