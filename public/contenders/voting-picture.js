import { votingPicture } from './render-picture.js';

async function prepare() {
  const id = new URLSearchParams(location.search).get('song');
  const response = await fetch('/api/christmas-contenders');
  if (!response.ok) throw new Error();
  const { entries } = await response.json();
  const song = entries.find(entry => entry.id === id && entry.mode === 'live' && entry.approved);
  if (!song) throw new Error();
  const blob = await votingPicture(song);
  const url = URL.createObjectURL(blob);
  const picture = document.querySelector('#picture');
  picture.src = url;
  picture.alt = 'Up vote ' + song.title + ' by ' + song.artist + ' on Santa Radio';
  picture.hidden = false;
  const download = document.querySelector('#download');
  download.download = 'Santa-Radio-' + song.id + '.png';
  download.href = url;
  download.hidden = false;
  document.querySelector('#vote').hash = song.anchor || song.id;
  document.querySelector('#status').textContent = 'Save the picture and share it with your voting link.';
}

prepare().catch(() => {
  document.querySelector('#status').textContent = 'This voting picture could not be loaded. Refresh to try again or visit the voting page.';
});
