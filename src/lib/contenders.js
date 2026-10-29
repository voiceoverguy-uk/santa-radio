export const COMPETITION = 'christmas-contenders-2026';
export const defaultSettings = {
  opensAt: '2026-11-01T00:00:00.000Z',
  closesAt: '2026-11-30T23:59:59.999Z',
  availability: 'scheduled', demoAvailability: 'open', submissionCutoff: null,
  repeatDemo: false,
};
export const bobEntry = {
  id: 'bob-the-elf', anchor: 'bob-the-elf', artist: 'Bob the Elf',
  title: 'We Wish You a Merry Christmas', mode: 'demo', approved: true,
  description: 'A cheerful festive singalong from the North Pole’s own Bob the Elf.',
  artwork: '/contenders/bob-the-elf.png', audio: '/contenders/test-song.mp3',
};
export function votingStatus(settings, now = Date.now()) {
  if (settings.availability === 'unavailable') return 'unavailable';
  if (settings.availability === 'closed') return 'closed';
  if (now < Date.parse(settings.opensAt)) return 'upcoming';
  return now > Date.parse(settings.closesAt) ? 'closed' : 'open';
}
export function secureMediaLink(value) {
  if (typeof value !== 'string' || value.length > 400) return false;
  if (/^\/contenders\/[a-zA-Z0-9._-]+$/.test(value)) return true;
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }
  catch { return false; }
}
