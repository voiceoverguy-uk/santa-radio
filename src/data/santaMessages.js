// Only publish entries whose recorded name and finished message have been checked.
// Replace this small catalogue with a search API when the recording library grows.
const messages = new Map([
  ['arabella', {
    name: 'Arabella',
    url: '/audio/messages/arabella.mp3',
    downloadName: 'Santa-message-for-Arabella.mp3',
  }],
]);

export function findSantaMessage(input) {
  if (typeof input !== 'string') return null;
  return messages.get(input.normalize('NFKC').trim().toLocaleLowerCase('en-GB')) ?? null;
}
