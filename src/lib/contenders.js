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
// Source-backed public catalogue used only when shared storage or signing is
// unavailable. Keep this list aligned with the approved live seeds in SQL.
export const sourceApprovedContenders = [
  {
    id: 'sam-ringer-lonely-little-christmas-tree',
    artist: 'Sam Ringer',
    title: 'Lonely Little Christmas Tree',
    artwork: '/contenders/sam-ringer-lonely-little-christmas-tree.jpeg',
    audio: '/contenders/sam-ringer-lonely-little-christmas-tree.mp3',
  },
  {
    id: 'sichi-xmas-in-milan',
    artist: 'Sichi',
    title: 'Xmas in Milan',
    artwork: '/contenders/sichi-xmas-in-milan.jpeg',
    audio: '/contenders/sichi-xmas-in-milan.mp3',
  },
  {
    id: 'paul-byers-the-thought-that-counts',
    artist: 'Paul Byers',
    title: 'The Thought That Counts',
    artwork: '/contenders/paul-byers-the-thought-that-counts.jpeg',
    audio: '/contenders/paul-byers-the-thought-that-counts.mp3',
  },
  {
    id: 'rich-stolp-i-cant-wait-for-christmas',
    artist: 'Rich Stolp',
    title: "I Can't Wait for Christmas",
    artwork: '/contenders/rich-stolp-i-cant-wait-for-christmas.jpg',
    audio: '/contenders/rich-stolp-i-cant-wait-for-christmas.mp3',
  },
  {
    id: 'rob-dalton-snow-is-falling-on-this-christmas-day',
    artist: 'Rob Dalton',
    title: 'Snow Is Falling on This Christmas Day',
    artwork: '/contenders/rob-dalton-snow-is-falling.jpeg',
    audio: '/contenders/rob-dalton-snow-is-falling-on-this-christmas-day.mp3',
  },
  {
    id: 'louhi-no-time-to-say-goodbye',
    artist: 'Louhi',
    title: 'No Time to Say Goodbye',
    artwork: '/contenders/louhi-no-time-to-say-goodbye.jpg',
    audio: '/contenders/louhi-no-time-to-say-goodbye.mp3',
  },
  {
    id: 'ken-sealey-its-christmas-shake-your-bum',
    artist: 'Ken Sealey',
    title: 'It’s Christmas, Shake Your Bum',
    artwork: '/contenders/ken-sealey-its-christmas-shake-your-bum.jpeg',
    audio: '/contenders/ken-sealey-its-christmas-shake-your-bum.mp3',
  },
  {
    id: 'phillip-streets-a-little-bit-of-christmas-radio-mix',
    artist: 'Phillip Streets',
    title: 'A Little Bit of Christmas (Radio Mix)',
    artwork: '/contenders/santa-no-artwork.jpeg',
    audio: '/contenders/phillip-streets-a-little-bit-of-christmas-radio-mix.mp3',
  },
].map(entry => ({ ...entry, anchor: entry.id, mode: 'live', approved: true }));

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
