// Private, repeatable desk checks of the location-only claims. No recipients,
// recordings or inventory endpoints. A fetch/word match is evidence to inspect,
// not an automatic editorial approval or a claim that incidents really happened.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { regionalEditorialInventory } from '../server/studio-regional-stories.js';

const pageNames = {
  'U.S. Space & Rocket Center': 'U.S._Space_&_Rocket_Center',
  'Hawaiʻi Volcanoes National Park': 'Hawaiʻi_Volcanoes_National_Park',
  'Tallgrass Prairie National Preserve': 'Tallgrass_Prairie_National_Preserve',
  'St Paul’s Cathedral': "St_Paul's_Cathedral",
  'Lake Windermere': 'Windermere',
  'Iron Bridge': 'The_Iron_Bridge',
  'The Needles': 'The_Needles',
  'Giant’s Causeway': "Giant's_Causeway",
  'The Kelpies': 'The_Kelpies',
  'V&A Dundee': 'V%26A_Dundee',
  'Summerlee': 'Summerlee_Museum_of_Scottish_Industrial_Life',
  'Callanish Stones': 'Callanish_Stones',
  'Box Hill': 'Box_Hill,_Surrey',
  'Craters of the Moon': 'Craters_of_the_Moon_National_Monument_and_Preserve',
  'Glacier National Park': 'Glacier_National_Park_(U.S.)',
  'Chimney Rock': 'Chimney_Rock_National_Historic_Site',
  'The Alamo': 'Alamo_Mission',
  'National Space Centre': 'National_Space_Centre_(United_Kingdom)',
  'Natchez': 'Natchez,_Mississippi',
};
const locationTerms = {
  'District of Columbia': ['Washington, D.C.', 'District of Columbia'],
  'City of London': ['City of London', 'Ludgate Hill'],
  'Leicestershire': ['Leicester'],
  'East Riding of Yorkshire': ['East Riding of Yorkshire'],
  'Tyne and Wear': ['Gateshead'],
  'West Midlands': ['Birmingham'],
  'Aberdeen City': ['Aberdeen'],
  'City of Edinburgh': ['Edinburgh'],
  'Dundee City': ['Dundee'],
  'Glasgow City': ['Glasgow'],
  'Highland': ['Highlands', 'Highland'],
  'Orkney Islands': ['Orkney'],
  'Shetland Islands': ['Shetland'],
  'Western Isles': ['Outer Hebrides', 'Lewis'],
  'Isle of Anglesey': ['Anglesey'],
  'Newport': ['Newport'],
  'Londonderry': ['County Londonderry'],
};
const plain = html => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, ' ')
  .replace(/&(?:#160|nbsp);/g, ' ').replace(/&#0?39;|&apos;/g, '’')
  .replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const rows = Object.entries(regionalEditorialInventory).flatMap(([folder, entries]) =>
  Object.values(entries).map(entry => ({ folder, ...entry })));
const only = process.argv.find(argument => argument.startsWith('--only='))?.slice(7);
if (only) rows.splice(0, rows.length, ...rows.filter(row => row.label === only));
const results = [];
let cursor = 0;
await Promise.all(Array.from({ length: 5 }, async () => {
  while (cursor < rows.length) {
    const { folder, label, anchor } = rows[cursor++];
    const title = pageNames[anchor] || encodeURIComponent(anchor.replaceAll(' ', '_'));
    const url = anchor === 'National Space Centre'
      ? 'https://www.spacecentre.co.uk/plan-explore/how-to-find-us/'
      : `https://en.wikipedia.org/wiki/${title}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = plain(await response.text());
      // Skip navigation: the first substantive location occurrence, if found.
      const terms = locationTerms[label] || [label];
      const positions = terms.map(term => text.toLowerCase().indexOf(term.toLowerCase(), 1500)).filter(i => i >= 0);
      const at = positions.length ? Math.min(...positions) : -1;
      results.push({ folder, label, anchor, url, checked: new Date().toISOString().slice(0, 10),
        status: at >= 0 ? 'Location evidence found; inspect excerpt' : 'REVIEW: location term not found',
        evidence: at >= 0 ? text.slice(Math.max(0, at - 90), at + 180) : text.slice(1500, 1800) });
    } catch (error) {
      results.push({ folder, label, anchor, url, status: `UNAVAILABLE: ${error.message}` });
    }
  }
}));
if (only) {
  const previous = JSON.parse(await readFile('.local/studio-letter-editorial/regional-source-checks.json', 'utf8'));
  results.push(...previous.filter(row => row.label !== only));
}
results.sort((a, b) => a.folder.localeCompare(b.folder) || a.label.localeCompare(b.label));
await mkdir('.local/studio-letter-editorial', { recursive: true });
await writeFile('.local/studio-letter-editorial/regional-source-checks.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify({ checked: results.length, flagged: results.filter(r => !r.status.startsWith('Location')).map(r => ({
  label: r.label, anchor: r.anchor, status: r.status,
})) }, null, 2));
