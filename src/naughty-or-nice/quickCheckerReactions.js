// One shared pool, deliberately unrelated to the preliminary percentage.
export const QUICK_CHECKER_REACTIONS = Object.freeze([
  '/audio/naughty-or-nice/reaction-01.mp3',
  '/audio/naughty-or-nice/reaction-02.mp3',
  '/audio/naughty-or-nice/reaction-03.mp3',
  '/audio/naughty-or-nice/reaction-04.mp3',
  '/audio/naughty-or-nice/reaction-05.mp3',
  '/audio/naughty-or-nice/reaction-06.mp3',
  '/audio/naughty-or-nice/reaction-07.mp3',
  '/audio/naughty-or-nice/reaction-08.mp3',
]);

export const selectQuickCheckerReaction = (random = Math.random) =>
  QUICK_CHECKER_REACTIONS[Math.floor(random() * QUICK_CHECKER_REACTIONS.length)];
