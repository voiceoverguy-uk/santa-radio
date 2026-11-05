// Run after the spacing spec; all generated evidence remains ignored by Git.
import { readFile, writeFile } from 'node:fs/promises';
import { studioLetterLayout } from '../src/lib/studioLetterLayout.js';

const directory = 'generated-artifacts/studio-spacing';
const rows = JSON.parse(await readFile(`${directory}/longest-measurements.json`, 'utf8'));
const erin = JSON.parse(await readFile(`${directory}/erin-measurements.json`, 'utf8'));
const image = async name => `data:image/png;base64,${(await readFile(`${directory}/${name}`)).toString('base64')}`;
const currentImage = await image('erin-current.png');
const trialImage = await image('erin-trial-not-applied.png');
const escape = text => String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const worst = (renderer, leading) => rows.filter(row => row.renderer === renderer && row.leading === leading)
  .reduce((best, row) => row.end > best.end ? row : best);
const size = 595.2756 * studioLetterLayout.body;
const safe = 841.8898 * (studioLetterLayout.bottom - studioLetterLayout.top);
const pdf = worst('pdf', studioLetterLayout.leading);
const maxLeading = (safe - 14 * size * studioLetterLayout.paragraphGap
  - 595.2756 * studioLetterLayout.signature * 1.5) / (pdf.lines * size);
const summary = ['browser', 'browser-fallback', 'pdf'].map(renderer =>
  [worst(renderer, studioLetterLayout.leading), worst(renderer, 1.25)]).flat();
const html = `<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Studio letter spacing — measured limit</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5f1e7;color:#19392d;font:16px/1.55 system-ui,sans-serif}
main{max-width:1100px;margin:auto;padding:28px 22px}h1,h2{line-height:1.2}
.notice{border-left:5px solid #9b3832;background:#fff;padding:16px 22px}
.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
figure{margin:0}figcaption{font-weight:700;margin:12px 0}figure img{width:100%;height:auto;display:block}
table{border-collapse:collapse;width:100%;background:#fff;font-size:14px}th,td{text-align:left;padding:10px;border-bottom:1px solid #ddd}
.scroll{overflow:auto}code{background:#fff;padding:2px 5px}small{color:#526457}
@media(max-width:650px){.comparison{grid-template-columns:1fr}}
</style><main>
<h1>Studio letter spacing: owner chose to leave it unchanged</h1>
<p>Measured on ${new Date().toISOString().slice(0, 10)}. This is development evidence, not a deployed change.</p>
<div class="notice"><strong>No production spacing change has been applied.</strong>
The trial below improves Erin’s letter but does not fit the longest supported content.
The existing browser layout also has a longest-content overflow. No text has been shortened,
no body type reduced, no individual letter compressed and no overflow hidden to conceal this.</div>
<h2>Same-size Erin comparison</h2>
<p>The wording follows the supplied Erin screenshot. Both sheets below have the same dimensions:
${erin.before.sheet.width.toFixed(1)} × ${erin.before.sheet.height.toFixed(1)} browser pixels,
with unchanged body size, artwork, signature and watermark. This is the current workspace rendering,
not a claim that the owner’s screenshot was captured from a particular build.</p>
<div class="comparison">
<figure><figcaption>Current: 1.17 line height, 0.10em paragraph gap</figcaption><img alt="Current complete Erin letter" src="${currentImage}"></figure>
<figure><figcaption>Trial only: 1.25 line height, 0.18em paragraph gap</figcaption><img alt="Unapplied trial with increased spacing" src="${trialImage}"></figure>
</div>
<p>Actual wrapped-line pitch, normalised to A4: ${erin.before.pitch[0].toFixed(2)}pt →
${erin.trial.pitch[0].toFixed(2)}pt. The extra separation is visible without changing font size.
Erin’s closing ends at ${(erin.before.end * 100).toFixed(1)}% → ${(erin.trial.end * 100).toFixed(1)}% of the page.</p>
<h2>What is rendering now?</h2>
<p>Actual inline-fragment measurements confirm that homepage examples, the personalised Review component,
thumbnails and enlarged previews use the shared 1.17 leading and 0.10em gaps.
The exported PDF’s extracted line positions confirm the same intended print spacing.
There was no CSS override or stale module in the tested workspace. The earlier preferred screenshot has
visibly greater separation than the compact reference; the small 1.15-to-1.17 increase does not recreate that appearance.</p>
<p>The supplied screenshot’s wrapping differs from this Linux rendering. Its source build and installed fonts cannot
be established from an image alone. On this machine, both Georgia and Times New Roman resolve to DejaVu Serif;
the requested fallback-font run therefore is not evidence of a second independently installed typeface.
The PDF’s embedded font was measured independently. Physical Safari was not tested.</p>
<h2>The one-page constraint</h2>
<p>A4 is 595.28 × 841.89pt. The fixed safe writing band runs from 24% to 88%:
<strong>${safe.toFixed(2)}pt available</strong>. The audit independently maximises wrapped height in each
paragraph across the current authorised non-name catalogue, every authored narrative, regional parent labels,
all 25 jokes, all postscripts and seven age bands, using an accepted 80-character written name.</p>
<div class="scroll"><table><thead><tr><th>Renderer</th><th>Line height / paragraph gap</th><th>Closing end</th><th>Beyond safe area</th></tr></thead><tbody>
${summary.map(row => `<tr><td>${escape(row.renderer)}</td><td>${row.leading.toFixed(2)} / ${row.paragraphGap.toFixed(2)}em</td>
<td>${(row.end * 100).toFixed(2)}%</td><td>${row.excessPoints.toFixed(2)}pt</td></tr>`).join('')}
</tbody></table></div>
<p>Even retaining the current paragraph gaps, the longest embedded-PDF combination allows at most
<strong>${maxLeading.toFixed(4)} line height</strong> before the safe boundary.
That is only ${((maxLeading - studioLetterLayout.leading) * size).toFixed(2)}pt extra per line.
The longest browser case already exceeds the boundary at the current setting, so there is no shared
positive spacing increase that meets every stated constraint.</p>
<h2>PDF inspection and checks</h2>
<p>The actual Erin PDF and independently maximised longest PDF each contain one A4 page.
Extracted text includes every paragraph, Santa’s signature, North Pole closing and complete P.S.;
measured PDF text bounds remain within the current safe band. The PDF rejects an overfull layout
rather than silently shrinking or adding pages.</p>
<p>The focused spacing checks measure real line fragments and PDF positions, not merely agreement
with constants. The separate existing strict longest-content test remains unchanged and fails at the
current browser spacing. The evidence audit deliberately reports overflow; it is not a passing fit claim.</p>
<h2>Owner decision</h2>
<p><strong>The owner chose “Leave spacing unchanged” after reviewing these limits.</strong>
The larger-spacing trial remains unapplied. There is no approval to shorten the wording,
change the body size, add a page or compress individual letters.
Keeping the current spacing avoids worsening the overflow, but does not resolve the reported appearance
or the existing longest-browser fit problem. This closes the investigation with an unchanged layout,
not a claim that the appearance or extreme-case fit has been fixed.</p>
<h2>Reproduce</h2>
<p><code>npx playwright test tests/santa-studio-letter-spacing.spec.js --project=chromium</code><br>
<code>node scripts/report-studio-letter-spacing.mjs</code></p>
<small>Generated evidence stays under generated-artifacts; no name inventory, recording identifiers,
audio, access or purchase data is included in this report.</small>
</main></html>`;
await writeFile(`${directory}/spacing-report.html`, html);
console.log(`${directory}/spacing-report.html`);
