// Explicit allowlist: never copy the website tree or an earlier archive.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const out = path.resolve(root, process.argv[2] || 'generated-artifacts/iphone-tracker/source');
if (!out.startsWith(path.join(root, 'generated-artifacts/'))) throw Error('Output must be in generated-artifacts');
if (fs.existsSync(out)) throw Error('Choose a fresh output directory');
fs.mkdirSync(out, { recursive: true });
const write = (name, text) => {
  fs.mkdirSync(path.dirname(path.join(out, name)), { recursive: true });
  fs.writeFileSync(path.join(out, name), text);
};
const provenance = [];
function copy(source, dest = source) {
  const bytes = fs.readFileSync(path.join(root, source));
  write(dest, bytes);
  provenance.push({ source, exported: dest, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
}
for (const name of ['SantaTrackerClient', 'SantaMap', 'SantaStats', 'SantaStory', 'SantaTimeline', 'SantaPreviewPanel']) {
  copy(`src/tracker/components/${name}.tsx`);
}
for (const name of ['santaRoute.ts', 'santaPreview.ts', 'trackerBrand.js']) copy(`src/tracker/lib/${name}`);
for (const name of ['santaRouteStops.ts', 'santaRouteExtras.ts', 'santaActivities.ts', 'santaHolidays.ts', 'worldMapPaths.ts', 'christmasFacts.ts']) copy(`src/tracker/data/${name}`);
copy('src/tracker/tracker.css');
copy('src/tracker/tsconfig.json', 'reference/original-tsconfig.json');
copy('src/tracker/app/santa-tracker/page.tsx', 'reference/public-page.tsx');
copy('src/tracker/app/santa-tracker/preview/page.tsx', 'reference/preview-page.tsx');
copy('public/images/santa-post-stamp.png', 'src/assets/santa-post-stamp.png');
for (const name of ['Caveat-variable.ttf', 'Caveat-OFL.txt', 'Caveat-PROVENANCE.txt']) {
  copy(`public/fonts/${name}`, `src/assets/fonts/${name}`);
}
// Download these public OFL fonts once, separately from any project secrets.
for (const name of fs.readdirSync(path.join(root, 'generated-artifacts/iphone-tracker/fonts'))) {
  copy(`generated-artifacts/iphone-tracker/fonts/${name}`, `src/assets/fonts/${name}`);
}
// Current tracker page uses just this small shared reset/typography boundary.
const indexCss = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
write('src/host.css', indexCss.slice(indexCss.indexOf(':root'), indexCss.indexOf('.gold-text')) + `
/* The only shared SEO rules used by this page. */
.tracker-questions {max-width:1100px;margin:2rem auto;padding:1.5rem;color:inherit}
.tracker-questions p {line-height:1.7}
/* Export-only: respect iPhone safe areas without imposing an app shell. */
body {padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
`);
// Preserve current public content; remove website SEO service imports and local
// navigation into unrelated pages. Keep an untouched reference for comparison.
let page = fs.readFileSync(path.join(root, 'src/tracker/app/santa-tracker/page.tsx'), 'utf8');
page = page.replace('import PageSeo from "../../../seo/PageSeo";\n', '')
  .replace('import { trackerMetadata, trackerQuestions } from "../../../seo/catalogue";', 'import { trackerQuestions } from "../../../questions";')
  .replace('    <PageSeo metadata={trackerMetadata()} />\n', '')
  .replace('href="/christmas-music"', 'href="https://www.santaradio.co.uk/christmas-music"')
  .replace('href="/mugshots/all"', 'href="https://www.santaradio.co.uk/mugshots/all"');
write('src/tracker/app/santa-tracker/page.tsx', page);
const catalogue = fs.readFileSync(path.join(root, 'src/seo/catalogue.js'), 'utf8');
write('src/questions.js', catalogue.match(/export const trackerQuestions = \[[\s\S]*?\n\];/)[0]);
let css = fs.readFileSync(path.join(out, 'src/tracker/tracker.css'), 'utf8');
// Homepage-only banner styling is not used by the exported page. Remove its
// image URL, rather than shipping an unrelated background to satisfy Vite.
css = css.replace('url("/fonts/Caveat-variable.ttf")', 'url("../assets/fonts/Caveat-variable.ttf")')
  .replace('url("../assets/home/tracker-background.webp")', 'none');
write('src/tracker/tracker.css', css);
let story = fs.readFileSync(path.join(out, 'src/tracker/components/SantaStory.tsx'), 'utf8');
story = story.replace('import { Share2 }', 'import stampUrl from "../../assets/santa-post-stamp.png";\nimport { Share2 }')
  .replace('src="/images/santa-post-stamp.png"', 'src={stampUrl}');
write('src/tracker/components/SantaStory.tsx', story);
write('src/vite-env.d.ts', '/// <reference types="vite/client" />\n');
for (const name of ['index.html', 'vite.config.js', 'tsconfig.json', 'src/main.tsx', 'src/fonts.css', 'scripts/finalize-build.mjs', 'scripts/check-route.cjs', 'scripts/check-browser.mjs', 'README.md', 'RECEIVING-DEVELOPER.txt', 'VERIFICATION.md']) {
  copy(`docs/iphone-tracker/template/${name}`, name);
}
// Reuse exact installed versions and their transitive/optional dependency graph.
// This preserves integrity hashes and platform packages, not website services.
const all = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')).packages;
const runtime = ['react', 'react-dom', 'lucide-react', 'html-to-image'];
const dev = ['vite', '@vitejs/plugin-react', '@tailwindcss/vite', 'tailwindcss', 'typescript', '@types/react', '@types/react-dom', '@playwright/test'];
const versions = names => Object.fromEntries(names.map(n => [n, all[`node_modules/${n}`].version]));
const pkg = {
  name: 'santa-radio-iphone-tracker-handover', version: '1.0.0', private: true, type: 'module',
  engines: { node: '>=22.0.0' },
  scripts: { dev: 'vite --host 0.0.0.0 --port 5173', build: 'tsc --noEmit && vite build && node scripts/finalize-build.mjs',
    preview: 'vite preview --host 0.0.0.0 --port 5173', test: 'node --test scripts/check-route.cjs',
    'test:browser': 'node scripts/check-browser.mjs' },
  dependencies: versions(runtime), devDependencies: versions(dev),
};
write('package.json', JSON.stringify(pkg, null, 2) + '\n');
const selected = {};
function resolve(name, parent) {
  let at = parent;
  for (;;) {
    const candidate = `${at ? at + '/' : ''}node_modules/${name}`;
    if (all[candidate]) return candidate;
    if (!at) return null;
    at = at.includes('/node_modules/') ? at.slice(0, at.lastIndexOf('/node_modules/')) : '';
  }
}
function visit(key) {
  if (selected[key]) return;
  const node = structuredClone(all[key]);
  if (node.resolved) {
    const url = new URL(node.resolved);
    if (url.hostname !== 'registry.npmjs.org') throw Error(`Nonportable dependency: ${key}`);
  }
  selected[key] = node;
  for (const name of new Set([...Object.keys(node.dependencies || {}), ...Object.keys(node.optionalDependencies || {}), ...Object.keys(node.peerDependencies || {})])) {
    if (Array.isArray(node.bundleDependencies) && node.bundleDependencies.includes(name)) continue;
    const resolved = resolve(name, key);
    if (resolved) visit(resolved);
    else if (!node.peerDependenciesMeta?.[name]?.optional && !node.optionalDependencies?.[name]) throw Error(`Unresolved ${name}`);
  }
}
for (const name of [...runtime, ...dev]) visit(`node_modules/${name}`);
write('package-lock.json', JSON.stringify({ name: pkg.name, version: pkg.version, lockfileVersion: 3, requires: true,
  packages: { '': { name: pkg.name, version: pkg.version, dependencies: pkg.dependencies, devDependencies: pkg.devDependencies, engines: pkg.engines }, ...selected } }, null, 2) + '\n');
write('SOURCE-MANIFEST.json', JSON.stringify({ description: 'Hashes describe original allowlisted inputs before documented export-only adaptation.', files: provenance }, null, 2) + '\n');
write('.gitignore', 'node_modules/\ndist/\n*.log\n');
console.log(`Assembled ${out}; ${Object.keys(selected).length} locked dependency entries`);
