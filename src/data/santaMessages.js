// This catalogue describes source recordings, never completed messages.
export const santaNames = ['Arabella', 'Callie', 'Charlotte', 'Darren', 'Ed', 'Erin', 'Freya', 'Harry', 'Jack', 'Jess', 'Jessica', 'Layla', 'Olivia'];
const messages = new Map(santaNames.map(name => [name.toLowerCase(), {
  id: name.toLowerCase(), name, downloadName: `Santa-message-for-${name}.mp3`,
}]));

export function searchSantaNames(input) {
  const prefix = input.normalize('NFKC').trim().toLocaleLowerCase('en-GB');
  return prefix ? santaNames.filter(name => name.toLowerCase().startsWith(prefix)) : [];
}

export function findSantaMessage(input) {
  if (typeof input !== 'string') return null;
  return messages.get(input.normalize('NFKC').trim().toLocaleLowerCase('en-GB')) ?? null;
}
