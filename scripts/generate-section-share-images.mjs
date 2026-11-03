import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedDir = resolve(root, 'generated-artifacts');
const logoPath = resolve(root, 'attached_assets/santa-radio-gold-logo_1791446660391.png');
const heroPath = resolve(root, 'public/images/north-pole-hero.webp');
const santaPath = resolve(root, 'attached_assets/santa_1791805807949.png');
const mugshotsPath = resolve(root, 'public/mugshot-images/santa-mugshots-logo-1.png');
const appsPath = resolve(root, 'src/assets/apps/santa-radio-ios-radio.webp');
const trackerPath = resolve(root, 'src/assets/apps/santa-radio-ios-tracker.webp');

const assets = Object.fromEntries(await Promise.all([
  ['logo', logoPath, 'image/png'],
  ['hero', heroPath, 'image/webp'],
  ['santa', santaPath, 'image/png'],
  ['mugshots', mugshotsPath, 'image/png'],
  ['apps', appsPath, 'image/webp'],
  ['tracker', trackerPath, 'image/webp'],
].map(async ([key, path, type]) => [key, {
  data: (await readFile(path)).toString('base64'),
  type,
}])));

const dataImage = key => `data:${assets[key].type};base64,${assets[key].data}`;
const cards = [
  {
    path: '/images/free-santa-message-share-v1.jpg',
    title: 'A free message from Santa?',
    titleLines: ['A free message', 'from Santa?'],
    button: 'Download now',
    buttonWidth: 330,
    alt: 'Santa Radio — A free message from Santa? Download now. Santa wearing headphones and speaking into a microphone against the North Pole scene.',
    visual: 'santa',
  },
  {
    path: '/images/celebrity-mugshots-share-v1.jpg',
    title: 'Celebrity Mugshots',
    titleLines: ['Celebrity Mugshots'],
    button: 'View Mugshots',
    buttonWidth: 360,
    alt: 'Santa Radio — Celebrity Mugshots. View Mugshots. Santa Radio Mugshots badge against the North Pole scene.',
    visual: 'mugshots',
  },
  {
    path: '/images/christmas-music-share-v1.jpg',
    title: 'Music on Santa Radio',
    titleLines: ['Music on Santa', 'Radio'],
    button: 'Explore the music',
    buttonWidth: 405,
    alt: 'Santa Radio — Music on Santa Radio. Explore the music. Santa with headphones, musical notes and a microphone against the North Pole scene.',
    visual: 'music',
  },
  {
    path: '/images/santa-radio-free-apps-share-v1.jpg',
    title: 'Santa Radio – Free Apps',
    titleLines: ['Santa Radio –', 'Free Apps'],
    button: 'Explore the apps',
    buttonWidth: 390,
    alt: 'Santa Radio — Free Apps. Explore the apps. A real Santa Radio app screen against the North Pole scene.',
    visual: 'apps',
  },
  {
    path: '/images/santa-tracker-share-v2.jpg',
    title: 'Santa Tracker',
    titleLines: ['Santa Tracker'],
    button: 'Track Santa',
    buttonWidth: 315,
    alt: 'Santa Radio — Santa Tracker. Track Santa. The real Santa Radio Tracker map screen against the North Pole scene.',
    visual: 'tracker',
  },
];

const xml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function visualMarkup(visual) {
  if (visual === 'santa' || visual === 'music') {
    const music = visual === 'music';
    return `<circle cx="945" cy="318" r="225" fill="#0a221b" stroke="#D4AF37" stroke-width="5"/>
      <image x="720" y="93" width="450" height="450" preserveAspectRatio="xMidYMid slice" clip-path="url(#roundVisual)" href="${dataImage('santa')}"/>
      ${music ? `<path d="M1097 99v68c-8-6-21-8-32-2-12 6-15 20-6 27 7 6 18 5 28-1 8-5 12-12 12-22v-47l34-9v44c-8-5-19-6-29 0-12 6-14 19-5 25 8 6 19 4 28-2 7-5 11-12 11-21V78z" fill="#E7C25B" stroke="#17382B" stroke-width="4" stroke-linejoin="round"/>` : ''}`;
  }
  if (visual === 'mugshots') {
    return `<circle cx="945" cy="317" r="212" fill="#102c22" stroke="#D4AF37" stroke-width="6"/>
      <image x="712" y="108" width="466" height="417" preserveAspectRatio="xMidYMid meet" href="${dataImage('mugshots')}"/>`;
  }
  const key = visual === 'apps' ? 'apps' : 'tracker';
  return `<rect x="837" y="20" width="276" height="590" rx="38" fill="#071610" stroke="#D4AF37" stroke-width="5"/>
    <image x="846" y="29" width="258" height="572" preserveAspectRatio="xMidYMid slice" clip-path="url(#phoneScreen)" href="${dataImage(key)}"/>`;
}

function cardSvg(card) {
  const titleY = card.titleLines.length === 1 ? [350] : [314, 386];
  const title = card.titleLines.map((line, index) =>
    `<text x="65" y="${titleY[index]}" fill="#FFF8E7" font-family="Arial, Helvetica, sans-serif" font-size="60" font-weight="700" letter-spacing="-1.2">${xml(line)}</text>`
  ).join('\n');
  const buttonX = 65, buttonY = 470, buttonHeight = 90;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#061a14" stop-opacity=".90"/>
        <stop offset=".56" stop-color="#09251c" stop-opacity=".74"/>
        <stop offset="1" stop-color="#071a15" stop-opacity=".30"/>
      </linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#F4D979"/>
        <stop offset="1" stop-color="#D4AF37"/>
      </linearGradient>
      <clipPath id="roundVisual"><circle cx="945" cy="318" r="216"/></clipPath>
      <clipPath id="phoneScreen"><rect x="846" y="29" width="258" height="572" rx="29"/></clipPath>
    </defs>
    <image width="1200" height="630" preserveAspectRatio="xMidYMid slice" href="${dataImage('hero')}"/>
    <rect width="1200" height="630" fill="url(#shade)"/>
    <rect x="12" y="12" width="1176" height="606" rx="28" fill="none" stroke="#E1BE4A" stroke-opacity=".72" stroke-width="3"/>
    <image x="54" y="29" width="525" height="179" preserveAspectRatio="xMidYMid meet" href="${dataImage('logo')}"/>
    ${visualMarkup(card.visual)}
    <g aria-label="${xml(card.title)}">${title}</g>
    <rect x="${buttonX}" y="${buttonY}" width="${card.buttonWidth}" height="${buttonHeight}" rx="45" fill="url(#gold)"/>
    <text x="${buttonX + card.buttonWidth / 2}" y="${buttonY + 58}" text-anchor="middle" fill="#102319" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700">${xml(card.button)}</text>
  </svg>`;
}

await mkdir(resolve(root, 'public/images'), { recursive: true });
await mkdir(generatedDir, { recursive: true });

for (const card of cards) {
  const outputPath = resolve(root, `public${card.path}`);
  const sourcePath = resolve(generatedDir, 'section-share-source.svg');
  await writeFile(sourcePath, cardSvg(card));
  try {
    await execFileAsync('magick', [
      '-background', '#081e17', sourcePath, '-strip', '-sampling-factor', '4:2:0',
      '-quality', '88', '-define', 'jpeg:optimize-coding=true', outputPath,
    ]);
  } finally {
    await unlink(sourcePath).catch(() => {});
  }
  console.log(`Created ${outputPath}`);
}

const entries = await Promise.all(cards.map(async card => {
  const file = resolve(root, `public${card.path}`);
  const jpeg = (await readFile(file)).toString('base64');
  return { ...card, jpeg };
}));
const previewHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Santa Radio — section sharing cards</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:32px;background:#e8e5dc;color:#17382b;font:15px/1.5 system-ui,-apple-system,sans-serif}
    main{width:min(100%,1250px);margin:auto}
    h1{margin:0 0 10px;font:700 28px/1.2 Georgia,serif}
    .intro{margin:0 0 30px;color:#4f6258}
    .card{margin:0 0 36px;padding:22px;background:#fff;border:1px solid #d8d2c2;border-radius:14px;box-shadow:0 12px 35px #17382b12}
    h2{margin:0 0 14px;font-size:18px}
    .full{display:block;width:100%;height:auto}
    .phone{width:350px;max-width:100%;margin:22px 0 0}
    .phone-label{margin:0 0 8px;color:#596b60;font-size:12px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
    img{border-radius:6px}
    @media(max-width:600px){body{padding:16px}.card{padding:12px}}
  </style>
</head>
<body>
<main>
  <h1>Santa Radio section sharing cards</h1>
  <p class="intro">Full-size 1200 × 630 exports and 350-pixel messaging previews. Each card is shown at both sizes.</p>
  ${entries.map(card => `<section class="card">
    <h2>${xml(card.title)}</h2>
    <img class="full" alt="${xml(card.alt)}" src="data:image/jpeg;base64,${card.jpeg}">
    <div class="phone"><p class="phone-label">Messaging preview · 350 px</p><img class="full" alt="${xml(card.title)} at messaging-preview size" src="data:image/jpeg;base64,${card.jpeg}"></div>
  </section>`).join('\n')}
</main>
</body>
</html>`;
const previewPath = resolve(generatedDir, 'section-share-cards-preview.html');
await writeFile(previewPath, previewHtml);
console.log(`Created ${previewPath}`);
