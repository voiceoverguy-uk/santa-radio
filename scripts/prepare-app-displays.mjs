import { spawnSync } from 'node:child_process';

// Non-destructive display extraction from the owner's approved compositions.
// Coordinates are measured on 471 × 1024 previews.
// The four points describe the display plane, not the surrounding phone rim.
// No inpainting, generated UI, older screenshots or camera overlays are used.
const displays = [
  ['christmas-radio-app-1_1792073461217.png', 'christmas-radio-screen-1.webp', 471, 520, 1130,
    [[158, 369], [374, 384], [344, 899], [102, 884]]],
  ['christmas-radio-app-2_1792073461217.png', 'christmas-radio-screen-2.webp', 471, 520, 1130,
    [[147, 380], [404, 401], [330, 976], [68, 953]]],
  ['christmas-radio-app-3_1792073461217.png', 'christmas-radio-screen-3.webp', 471, 520, 1130,
    [[118, 251], [396, 270], [389, 940], [73, 925]]],
  ['christmas-radio-app-4_1792073461216.png', 'christmas-radio-screen-4.webp', 471, 520, 1130,
    [[81, 277], [388, 277], [388, 932], [81, 932]]],
];

function run(args) {
  const result = spawnSync('magick', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'ImageMagick failed');
  return result.stdout;
}

for (const [source, output, previewWidth, width, height, corners] of displays) {
  const input = `attached_assets/${source}`;
  const sourceWidth = Number(run(['identify', '-format', '%w', input]));
  const scale = sourceWidth / previewWidth;
  const target = [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]];
  const mapping = corners.map(([x, y], index) =>
    `${x * scale},${y * scale} ${target[index].join(',')}`).join(' ');
  run([input, '-alpha', 'off', '-virtual-pixel', 'edge',
    '-define', `distort:viewport=${width}x${height}+0+0`,
    '-distort', 'Perspective', mapping, '+repage', '-strip',
    '-quality', '90', `src/assets/apps/${output}`]);
  console.log(`${output}: ${width} × ${height}`);
}

// Owner-approved existing screen-only originals. Keep their full dimensions,
// interface and controls intact; retain both PNG and promotional sources.
for (const name of ['santa-voicemail', 'santa-messages', 'santa-text']) {
  run([`src/assets/apps/${name}.png`, '-strip', '-quality', '90',
    `src/assets/apps/${name}-screen.webp`]);
  console.log(`${name}-screen.webp: full original display`);
}

// Explicit owner approval for this section only: the supplied rooftop artwork
// belongs inside the dark landscape handset. Preserve its entire composition;
// the opening follows its native ratio, so no title/caption crop is necessary.
// Never rebuild this display from the legacy santa-dash.png gameplay capture.
run(['attached_assets/Inflatable_Santa_joins_the_rooftop_dash_1793488526959.png',
  '-resize', '1488x676', '-strip', '-quality', '85',
  'src/assets/apps/santa-dash-screen.webp']);
// Decode the delivered WebP to make recovery pixel-equivalent, not a second
// lossy rendition of the original.
run(['src/assets/apps/santa-dash-screen.webp', '-strip',
  'src/assets/apps/santa-dash-screen.png']);
console.log('santa-dash-screen: complete approved rooftop artwork, 1488 × 676');
