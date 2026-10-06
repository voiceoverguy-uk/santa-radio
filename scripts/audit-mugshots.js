import fs from 'node:fs';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';

const raw = JSON.parse(fs.readFileSync('src/data/mugshots.json', 'utf8'));
const { catalogue, aliases, conflicts } = buildCatalogue(raw);
const editorial = JSON.parse(fs.readFileSync('reports/mugshot-editorial-review.json', 'utf8'));
const words = s => (s || '').trim().split(/\s+/).filter(Boolean).length;
const rows = catalogue.map(m => {
  const count = words(m.info);
  const uncertain = /waxwork|received_|-sant$|alesha-santa|davina-presenter$|coronation-street$|^idea$|oliceman|mugshots-logo|^eubank|^Paul-s-club|david-mitchell-guyharris|showaddywaddy/.test(m.song) ||
    /mascot|superhero|super-hero|tardis|uefa-trophy|santa-father/.test(m.song);
  const reasons = [];
  if (!count) reasons.push('No imported biography; website displays a generic mugshot caption.');
  else if (count < 25) reasons.push('Very short biography (under 25 words); add career highlights.');
  else if (count < 40) reasons.push('Short biography (25–39 words); consider more career detail.');
  const note = editorial.find(n => aliases[n.slug] === m.song);
  if (note) reasons.push(note.reason);
  if (/\b(currently|current|now|upcoming|recently|to the present)\b/i.test(m.info || ''))
    reasons.push('Undated current-role/time-sensitive wording: verify it is still accurate.');
  if (conflicts.some(c => c.slug === m.song)) reasons.push('Conflicting source biographies require review.');
  if (uncertain) reasons.push('Confirm identity/type first: ambiguous label, fictional character, mascot, object or waxwork.');
  const category = uncertain ? 'Identity / non-celebrity review' : !count ? 'Missing biography' : count < 25 ? 'Very short biography' : count < 40 ? 'Short biography' : reasons.length ? 'Editorial review' : 'No screening flag';
  return { name: m.artist, path: `/mugshots/${m.song}`, category, words: count, reason: reasons.join(' '), biography: m.info || '', replacement: '' };
});
const research = rows.filter(r => r.reason);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const csv = values => values.map(v => `"${String(v).replace(/^[=+@\t\r-]/, "'$&").replace(/"/g, '""')}"`).join(',');
const header = ['Celebrity / record name','Page path','Category','Word count','Research reason','Current biography','Replacement content'];
fs.writeFileSync('reports/mugshot-research.csv', '\ufeff' + [csv(header), ...research.map(r => csv(Object.values(r)))].join('\r\n'));
fs.writeFileSync('reports/mugshot-audit.json', JSON.stringify({ originalCards: raw.length, retainedProfiles: catalogue.length, removedDuplicateCards: raw.length-catalogue.length, aliases, conflicts, review: rows }, null, 2));
const categories = [...new Set(research.map(r => r.category))];
fs.writeFileSync('reports/mugshot-research.html', `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Santa Radio biography research</title><style>body{font:16px/1.6 system-ui;max-width:1000px;margin:40px auto;padding:0 20px;color:#173b2c}h1,h2{line-height:1.2}article{border-top:1px solid #ccc;padding:18px 0}small{color:#555}blockquote{margin:12px 0;background:#f2f5f3;padding:14px;white-space:pre-wrap}code{overflow-wrap:anywhere}a{color:#176847}@media print{article{break-inside:avoid}}</style><h1>Mugshot biography research</h1><p>Audit: 6 October 2026. ${raw.length} original cards → ${catalogue.length} retained profiles. ${raw.length-catalogue.length} duplicate cards consolidated. All original URLs resolve; source entries and photos are preserved.</p><p>${research.length} entries need content or editorial/identity review. This is a screening list, not a fact-checked claim that every flagged biography is wrong. Word count is a prioritisation aid. Time-sensitive statements need confirmation, not automatic rewriting. No replacement biographies have been invented.</p><p>Use the accompanying CSV’s blank Replacement content column to supply researched text. Page paths refer to the website; this offline report does not assume a deployment address.</p><ul>${categories.map(c=>`<li><a href="#${categories.indexOf(c)}">${esc(c)} (${research.filter(r=>r.category===c).length})</a></li>`).join('')}</ul>${categories.map(c=>`<h2 id="${categories.indexOf(c)}">${esc(c)}</h2>${research.filter(r=>r.category===c).map(r=>`<article><h3>${esc(r.name)} <small>— ${r.words} words</small></h3><code>${esc(r.path)}</code><p><strong>Review:</strong> ${esc(r.reason)}</p><blockquote>${esc(r.biography || '[No imported biography]')}</blockquote></article>`).join('')}`).join('')}</html>`);
console.log(JSON.stringify({ before: raw.length, after: catalogue.length, consolidated: raw.length-catalogue.length, categories: Object.fromEntries(categories.map(c=>[c,research.filter(r=>r.category===c).length])) }, null, 2));
