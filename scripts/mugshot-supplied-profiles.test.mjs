import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';
import rawProfiles from '../src/data/mugshots.json' with { type: 'json' };
import biographies from '../src/data/mugshot-biographies.json' with { type: 'json' };
import editorial from '../src/data/mugshot-editorial-overrides.json' with { type: 'json' };
import { mugs, mugMetadata, mugPath, mugImageAlt, ORIGIN } from '../src/seo/catalogue.js';
import { canonicalPaths } from '../src/seo/routes.js';
import { sitemap } from '../server/public-html.js';

const profiles = [
  ['Alex James', 'alex-james-musician', 'alex-james-musician_1793282756645.jpg'],
  ['Gyles Brandreth', 'gyles-brandreth-tv-personality', 'gyles-brandreth-tv-personality_1793282756645.jpg'],
  ['Angry Ginge', 'angry-ginge-celeb-winner', 'angry-ginge-celeb-winner_1793282756646.jpg'],
  ['Harry Enfield', 'harry-enfield-tv-personality', 'harry-enfield-tv-personality_1793282756646.jpg'],
  ['Sam Ryder', 'sam-ryder-musician', 'sam-ryder-musician_1793282756646.jpg'],
  ['Paul Nicholas', 'paul-nicholas-actor', 'paul-nicholas-actor_1793282756646.jpg'],
  ['Steve Bracknall', 'steve-bracknall-podcaster', 'steve-bracknall-podcaster_1793282756646.jpg'],
  ['Paris Fury', 'paris-fury-boxing-wife', 'paris-fury-boxing-wife_1793282756646.jpg'],
  ['Sharon Marshall', 'sharon-marshall-queen-of-soaps', 'sharon-marshall-queen-of-soaps_1793282756646.jpg'],
  ['Tom Swarbrick', 'tom-swarbrick-tv-personality', 'tom-swarbrick-tv-personality_1793282756646.jpg'],
  ['Bryony Gordon', 'bryony-gordon-author', 'bryony-gordon-author_1793282756647.jpg'],
  ['Matt Edmondson & Mollie King', 'matt-edmondson-and-mollie-king', 'matt-edmondson-and-mollie-king_1793282756647.jpg'],
  ['Rylan', 'rylan-tv-star', 'rylan-tv-star_1793282756647.jpg'],
  ['Emma Willis', 'emma-willis-tv-personality', 'emma-willis-tv-personality_1793282756647.jpg'],
  ['Chris Ramsey', 'chris-ramsey-comedian', null],
];
const escapeHtml = value => value
  .replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;')
  .replaceAll('<', '&lt;').replaceAll('>', '&gt;');

test('supplied Mugshot copy, citations, original images, and featured choices are preserved', async () => {
  const suppliedText = await readFile('attached_assets/mugshots-biographies_1793282821886.txt', 'utf8');
  const supplied = new Map();
  for (const block of suppliedText.split(/\n\s*\n/)) {
    const [header, biography, ...rest] = block.trim().split('\n');
    const match = header?.match(/^(.+?) \| (.+?) \| Featured: (yes|no)$/);
    if (!match) continue;
    const sourceLine = rest.find(line => /^(?:Source|Sources): /.test(line));
    supplied.set(match[1], {
      role: match[2],
      featured: match[3] === 'yes',
      biography,
      sources: sourceLine
        ? sourceLine.replace(/^(?:Source|Sources): /, '').split('; ').map(source => source.trim())
        : [],
    });
  }

  const current = buildCatalogue(rawProfiles).catalogue;
  assert.equal(current.length, 664);
  const builtGallery = await readFile('dist/mugshots/all/index.html', 'utf8');
  const sourceInfoEligible = new Set(
    rawProfiles.filter(profile => typeof profile.info === 'string' && profile.info.trim()).map(profile => profile.song),
  );
  const featured = new Set([
    'alex-james-musician',
    'gyles-brandreth-tv-personality',
    'harry-enfield-tv-personality',
    'sam-ryder-musician',
    'paul-nicholas-actor',
    'rylan-tv-star',
    'emma-willis-tv-personality',
  ]);
  const featuredCount = current.filter(profile => profile.homepage === true).length;
  assert.ok(current.slice(0, featuredCount).every(profile => profile.homepage === true));
  assert.ok(current.slice(featuredCount).every(profile => profile.homepage !== true));
  for (const slug of featured) {
    assert.ok(current.slice(0, featuredCount).some(profile => profile.song === slug), `${slug}: A-list priority position`);
  }
  const establishedFeaturedOrder = current.slice(0, featuredCount).map(profile => profile.artist);
  assert.deepEqual(
    establishedFeaturedOrder,
    [...establishedFeaturedOrder].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true })),
  );

  for (const [name, slug, originalFile] of profiles) {
    const rawMatches = rawProfiles.filter(profile => profile.song === slug);
    assert.equal(rawMatches.length, 1, `${slug}: one raw record`);
    const raw = rawMatches[0];
    const approved = supplied.get(name);
    assert.ok(approved, `${name}: supplied biography block exists`);
    assert.ok(sourceInfoEligible.has(slug), `${slug}: non-empty source biography survives pre-override filtering`);
    assert.equal(raw.info, approved.biography, `${slug}: source biography matches approved copy`);
    const publicMatches = current.filter(profile => profile.song === slug);
    assert.equal(publicMatches.length, 1, `${slug}: one complete public record`);
    const profile = publicMatches[0];
    assert.equal(profile.artist, name);
    assert.equal(profile.link, approved.role);
    assert.equal(profile.info, approved.biography);
    assert.equal(biographies[slug], approved.biography);
    assert.equal(editorial[slug]?.homepage, featured.has(slug));
    assert.equal(editorial[slug]?.artist, name);
    assert.equal(editorial[slug]?.role, approved.role);
    assert.equal(profile.homepage, featured.has(slug));
    assert.deepEqual(editorial[slug]?.sources, approved.sources);
    assert.equal(raw.image, slug === 'chris-ramsey-comedian'
      ? '/mugshot-images/chris-ramsey-comedian.jpg'
      : `/mugshot-images/${slug}.jpg`);
    if (originalFile) {
      assert.deepEqual(
        await readFile(`public${raw.image}`),
        await readFile(`attached_assets/${originalFile}`),
        `${slug}: supplied photograph unchanged`,
      );
    } else {
      assert.equal(raw.artist, 'Chris Ramsey');
      assert.equal(raw.homepage, false);
    }

    const metadata = mugMetadata(profile);
    assert.equal(metadata.url, `${ORIGIN}${mugPath(profile)}`);
    assert.equal(metadata.image, `${ORIGIN}${raw.image}`);
    assert.equal(metadata.imageAlt, mugImageAlt(profile));
    assert.ok(canonicalPaths.includes(mugPath(profile)));
    assert.equal((sitemap().match(new RegExp(`<loc>${metadata.url}</loc>`, 'g')) || []).length, 1);
    assert.doesNotMatch(JSON.stringify(metadata.graph), /mugshot-editorial|futermanrose|itv\\.com|hachette\\.co\\.uk/);

    const builtDetail = await readFile(`dist${mugPath(profile)}/index.html`, 'utf8');
    assert.ok(builtGallery.includes(`href="${mugPath(profile)}"`), `${slug}: built gallery link`);
    assert.ok(builtDetail.includes(`rel="canonical" href="${metadata.url}"`), `${slug}: built canonical`);
    assert.ok(builtDetail.includes(`property="og:image" content="${metadata.image}"`), `${slug}: built Open Graph image`);
    assert.ok(builtDetail.includes(`name="twitter:image" content="${metadata.image}"`), `${slug}: built Twitter image`);
    assert.ok(builtDetail.includes(`property="og:image:alt" content="${escapeHtml(metadata.imageAlt)}"`), `${slug}: built image alt`);
    assert.ok(builtDetail.includes(escapeHtml(profile.info.slice(0, 60))), `${slug}: approved biography in built page`);
    assert.deepEqual(
      await readFile(`dist${raw.image}`),
      await readFile(`public${raw.image}`),
      `${slug}: built photograph matches the source asset`,
    );
  }

  const simulatedLegacyImport = buildCatalogue(rawProfiles.map(profile => ({
    ...profile,
    ...(editorial[profile.song] ? {
      artist: `Legacy ${profile.artist}`,
      link: 'Legacy import role',
      info: 'legacy import text',
      homepage: !editorial[profile.song].homepage,
    } : {}),
  }))).catalogue;
  for (const [name, slug] of profiles) {
    const profile = simulatedLegacyImport.find(record => record.song === slug);
    assert.ok(profile, `${slug}: supplied copy keeps the profile complete after import`);
    assert.equal(profile.artist, name);
    assert.equal(profile.link, supplied.get(name).role);
    assert.equal(profile.info, biographies[slug]);
    assert.equal(profile.homepage, editorial[slug].homepage);
  }
});

test('Matt and Mollie are two people; Steve Bracknall is a character', () => {
  const matt = mugs.find(profile => profile.song === 'matt-edmondson-and-mollie-king');
  const mattGraph = mugMetadata(matt).graph;
  assert.deepEqual(
    mattGraph.filter(node => node['@type'] === 'Person').map(node => node.name),
    ['Matt Edmondson', 'Mollie King'],
  );

  const steve = mugs.find(profile => profile.song === 'steve-bracknall-podcaster');
  const steveGraph = mugMetadata(steve).graph;
  assert.equal(steveGraph.find(node => node['@id'].endsWith('#character-steve-bracknall'))['@type'], 'Character');
  assert.equal(steveGraph.some(node => node['@type'] === 'Person' && node.name === 'Steve Bracknall'), false);
  assert.equal(mugImageAlt(steve), 'Chris McClure as Steve Bracknall with a Santa Radio mug');
});
