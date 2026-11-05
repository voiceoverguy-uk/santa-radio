// Run after the frame/spacing browser spec. All evidence stays ignored by Git.
import { readFile, writeFile } from 'node:fs/promises';
import { studioLetterLayout as type } from '../src/lib/studioLetterLayout.js';
const directory = 'generated-artifacts/studio-spacing';
const rows = JSON.parse(await readFile(`${directory}/longest-measurements.json`, 'utf8'));
const edward = JSON.parse(await readFile(`${directory}/edward-measurements.json`, 'utf8'));
const image = async name => `data:image/png;base64,${(await readFile(`${directory}/${name}`)).toString('base64')}`;
const before = await image('edward-before.png');
const after = await image('edward-after.png');
const pdf = await image('edward-rendered.png');
const longest = await image('longest-pdf-rendered.png');
const html = `<!doctype html><html lang="en-GB"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Santa letter writing frame — before and after</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5f1e7;color:#19392d;font:16px/1.55 system-ui,sans-serif}
main{max-width:1100px;margin:auto;padding:28px 22px}h1,h2{line-height:1.2}
.comparison{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
figure{margin:0}figcaption{font-weight:700;margin:12px 0}figure img{width:100%;height:auto;display:block}
table{border-collapse:collapse;width:100%;background:#fff;font-size:14px}th,td{text-align:left;padding:10px;border-bottom:1px solid #ddd}
.scroll{overflow:auto}small{color:#526457}@media(max-width:650px){.comparison{grid-template-columns:1fr}}
</style><main>
<h1>Santa letters: fitted writing frame</h1>
<p>Development evidence. The existing letterhead, watermarks, decorative signature, A4 page and
${(595.2756 * .0225).toFixed(2)}pt body size are unchanged. No production deployment was made.</p>
<h2>Same-size Edward comparison</h2>
<p>Reconstructed from the supplied Edward screenshot using its selected details and curated scenes.
These are current-workspace renderings, not a claim to reproduce the screenshot’s installed fonts.
Both sheets use exactly the same final wording and
${edward.after.sheet.width.toFixed(1)} × ${edward.after.sheet.height.toFixed(1)} pixel size.
The first uses the previous 1.17 leading and 0.10em paragraph spacing; the second uses the adaptive policy.</p>
<div class="comparison">
<figure><figcaption>Before: fixed cramped spacing</figcaption><img alt="Edward letter at previous fixed spacing" src="${before}"></figure>
<figure><figcaption>After: content-aware spacing</figcaption><img alt="Same Edward letter using more of the safe writing area" src="${after}"></figure>
</div>
<p>Edward’s P.S. visible ink moves from ${(edward.before.inkEnd * 100).toFixed(1)}% →
${(edward.after.inkEnd * 100).toFixed(1)}% of page height, while its complete text frame ends at
${(edward.after.end * 100).toFixed(1)}%. Actual normalised line pitch increases from
${edward.before.pitch[0].toFixed(2)}pt to ${edward.after.pitch[0].toFixed(2)}pt.
No ordinary Edward wording was shortened.</p>
<h2>Writing frame and fitting policy</h2>
<p>The invisible writing frame runs from 24% to 85.3% of A4 height, with 6% side insets.
The closing uses 10% insets to avoid the holly. The fit budget includes the signature’s ink clearance
and every line of the greeting, closing and P.S., plus a 3pt lower safety allowance. Visible text
ink is independently checked against an 85% edge above the lower artwork.</p>
<p>Line height varies from ${type.leading} to ${type.maxLeading}; paragraph gaps from
${type.paragraphGap}em to ${type.maxParagraphGap}em. Both rise together when space is available.
Short letters stop at these caps rather than developing enormous gaps.
Only if either renderer exceeds the minimum fit does the same letter switch to curated compact
reactions and matching shorter versions of its three scenes. Selected labels, age context, full
geographic story, reminder, Christmas joke and closing remain intact.
An unexpected unfit letter fails explicitly instead of clipping, shrinking, truncating or adding a page.</p>
<h2>Independently rendered one-page PDFs</h2>
<div class="comparison">
<figure><figcaption>Edward PDF rendered by Poppler</figcaption><img alt="Independent rendering of the complete Edward PDF" src="${pdf}"></figure>
<figure><figcaption>Longest embedded-font candidate</figcaption><img alt="Independent rendering of a compact longest-content PDF with an 80-character name" src="${longest}"></figure>
</div>
<p>The PDF embeds its existing serif and signature fonts. Browser wrapping is measured separately in
its real serif stack. Both decide on one wording before it is revealed; each uses spacing appropriate
to its own wrapping. Browser thumbnails and enlargements scale a fixed canonical HTML layout rather
than rewrapping. No recipient text leaves the browser.</p>
<h2>Longest supported combinations</h2>
<p>The authorised non-name catalogue, parent-qualified regions, every narrative, all jokes and
postscripts are independently maximised by wrapped lines, not by character count.
The check covers seven age bands and an accepted 80-character name.
Both full and compact alternatives are maximised conservatively. The separate contextual suite
also composes real choice combinations, retaining their exact personalisation.
Georgia and Times New Roman can resolve to the same Linux font; CSS fallback checks are not proof
of different installed fonts. Physical Safari, VoiceOver and home printing were not checked here.</p>
<div class="scroll"><table><thead><tr><th>Age</th><th>Maximised for</th><th>Compact required</th><th>PDF leading / gap</th><th>PDF end</th></tr></thead><tbody>
${rows.map(row => `<tr><td>${row.age}</td><td>${row.renderer}</td><td>${row.compact ? 'Yes' : 'No'}</td>
<td>${row.leading.toFixed(3)} / ${row.paragraphGap.toFixed(3)}em</td><td>${(row.end * 100).toFixed(2)}%</td></tr>`).join('')}
</tbody></table></div>
<h2>Safety checks</h2>
<p>Checks assert full-content agreement between visible, accessible and exported text, unchanged
font size, complete signature and P.S., left alignment, frame containment and stable wording through
enlargement, resizing and 200% interface text. PDFs are independently extracted and rendered,
and each has exactly one A4 page. Artificial unfit input shows an explicit error.</p>
<p>Reproduce: <code>npx playwright test tests/santa-studio-letter-spacing.spec.js tests/santa-studio-contextual-letter.spec.js --project=chromium</code>,
then <code>node scripts/report-studio-letter-spacing.mjs</code>.</p>
<small>Invented recipients only. Evidence remains outside the public build and contains no audio,
recording inventory, access or purchase data.</small></main></html>`;
await writeFile(`${directory}/spacing-report.html`, html);
console.log(`${directory}/spacing-report.html`);
