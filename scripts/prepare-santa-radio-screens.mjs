import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Current owner-supplied full iPhone displays. The two website/tab close-ups are
// references only. Never crop, redraw or add a camera over the actual interface.
const screens = [
  ['radio_1793564072969.png', 'radio'],
  ['tracker_1793564072966.png', 'tracker'],
  ['mugshots_1793564144716.png', 'mugshots'],
  ['artists_1793564076283.png', 'artists'],
  ['games_1793564076283.png', 'games'],
  ['splash_screen_1793564072969.png', 'welcome'],
];
function run(args) {
  const result = spawnSync('magick', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'ImageMagick failed');
}
// Fail before changing any deliveries if originals are unavailable.
for (const [source] of screens) {
  if (!existsSync(`attached_assets/${source}`)) throw new Error(`Missing native capture: ${source}`);
}
for (const [source, label] of screens) {
  const output = `src/assets/apps/santa-radio-ios-${label}`;
  run([`attached_assets/${source}`, '-resize', '50%', '-strip', '-quality', '90', `${output}.webp`]);
  // Recovery has the identical decoded pixels, not a different screenshot.
  run([`${output}.webp`, '-strip', `${output}.png`]);
  console.log(`${label}: complete 603 × 1311 WebP and PNG recovery`);
}
