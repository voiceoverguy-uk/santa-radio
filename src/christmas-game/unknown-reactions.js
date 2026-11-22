const lines = [
  'That one has my film elves scratching their heads.',
  'Hmm. That title isn’t ringing any sleigh bells.',
  'You’ve found a gap on my Christmas film shelf!',
  'Even my elf who watches the end credits is stumped.',
  'I’ve checked my list twice. That film’s a mystery to me.',
  'Pass me my reading glasses. I don’t recognise that one!',
  'I’ll have to ask Mrs Claus about that one.',
  'Well, that’s one for the North Pole film club!',
];

export function nextUnknownReaction(previous = []) {
  const history = Array.isArray(previous) ? previous.filter(line => lines.includes(line)) : [];
  let remaining = lines.filter(line => !history.includes(line));
  if (!remaining.length) remaining = lines.filter(line => line !== history.at(-1));
  const line = remaining[Math.floor(Math.random() * remaining.length)];
  return history.length >= lines.length ? [line] : [...history, line];
}
