// Independent expectations for supplied recording illustrations.
export const exactSongArtwork = [
  [288, 'Robbie Williams', 'Walk this Sleigh', 'robbie-williams-walk-this-sleigh'],
  [487, 'Robbie Williams', "Can't stop Christmas", 'robbie-williams-cant-stop-christmas'],
  [559, 'Robbie Williams', 'Bad Sharon', 'robbie-williams-bad-sharon'],
  [557, 'Freya Skye', 'Snow Angels', 'freya-skye-snow-angels'],
  [46, 'Frank Sinatra', 'Let It Snow! Let It Snow! Let It Snow!', 'frank-sinatra-let-it-snow'],
  [40, 'The Jackson 5', 'Santa Claus Is Coming To Town', 'jackson-5-santa-claus-is-coming-to-town'],
  [43, 'Gabriella Cilmi', 'Warm this Winter', 'gabriella-cilmi-warm-this-winter'],
  [537, 'Sia', 'Candy Cane Lane', 'sia-candy-cane-lane'],
  [538, 'Sia', 'Naughty & Nice', 'sia-naughty-and-nice'],
  [480, 'Sia', 'My Old Santa Claus', 'sia-my-old-santa-claus'],
  [457, 'Sia', "Santa's Coming For Us", 'sia-santas-coming-for-us'],
].map(([id, artist, title, filename]) => ({
  id, artist, title, path: `/artist-artwork/${filename}.webp`,
}));

export const observedLivePairs = [
  { artist: 'Paul Burling', title: 'Another Christmas Song', id: 439,
    credit: 'Paul Burling & Joseph Bell', path: '/artist-artwork/paul-burling.webp' },
  { artist: 'Tom Jones & C Matthews', title: 'Baby, Its Cold Outside', id: 5,
    credit: 'Tom Jones & Cerys Matthews', path: '/artist-artwork/tom-jones-and-cerys-matthews.webp' },
];
