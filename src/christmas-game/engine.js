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

export function nextTurn(history, { seed = 0, recentOpeners = [] } = {}) {
  const asked = new Set(history.map(({ question }) => question.id));
  const weights = films.map((_, index) => history.reduce((weight, { question, answer }) => {
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
    return { guess: confidence >= 0.25 ? films[leader] : null };
  }

  const ranked = [];
  for (const question of questionBank) {
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
    const pool = fresh.length ? fresh : storyQuestions;
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
