import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildCatalogue } from '../src/data/mugshot-catalogue.js';
import { matchesMugshot, mugshotSuggestions } from '../src/data/mugshot-search.js';
import { selectHomepageMugshots } from '../src/data/homepageMugshots.js';
const {catalogue} = buildCatalogue(JSON.parse(fs.readFileSync(new URL('../src/data/mugshots.json', import.meta.url))));
const find = name => { const profile = catalogue.find(x => x.artist === name); assert.ok(profile, name); return profile; };
test('both approved groups are prioritised and eligible for the homepage', () => {
  const promoted = 'Hugh Bonneville|Hayley Mills|Patrick Duffy|Philip Glenister|Ainsley Harriott|Fiona Bruce|Fern Britton|Gok Wan|Helen Skelton|John Bishop|Mo Gilligan|Alex Horne|Rhod Gilbert|Ronan Keating|Jools Holland|Heather Small|Paul Heaton|Ali Campbell|Pep Guardiola|Carlo Ancelotti|Jamie Vardy|Alex Scott|Ellie Simmonds|Steve Davis|Stephen Hendry|Adam Woodyatt|Steve McFadden|Shane Richie|Darcey Bussell|Motsi Mabuse|Scott Mills|Jordan North|Rick Wakeman|Matt Willis|Jimmy White|Tim Peake'.split('|');
  for (const name of promoted) assert.equal(find(name).homepage, true, name);
  assert.equal(catalogue.filter(x=>x.homepage===true).length,190);
  assert.ok(selectHomepageMugshots(promoted.map(find)).every(x=>x.homepage));
  assert.ok(catalogue.slice(0,190).every(x=>x.homepage));
});
test('all public profiles have categories and sport includes different disciplines', () => {
  assert.equal(catalogue.length,671);
  assert.ok(catalogue.every(x=>x.categories.length));
  for (const name of ['Jamie Vardy','Pep Guardiola','Carlo Ancelotti','Ellie Simmonds','Steve Davis','Chris Eubank Junior','Kevin Sinfield','Tom Daley','Mike Bushell','Michaela Tabb']) {
    assert.ok(matchesMugshot(find(name),'sport'),name);
    assert.ok(matchesMugshot(find(name),'sports'),name);
  }
  assert.ok(!matchesMugshot(find('John Bishop'),'sport'));
  assert.ok(!matchesMugshot(find('Paris Fury'),'boxing'));
  assert.ok(matchesMugshot(find('Michaela Tabb'),'snooker'));
  assert.ok(!matchesMugshot(find('Michaela Tabb'),'football'));
});
test('broad terms and synonyms find equivalent categories', () => {
  const slugs=q=>catalogue.filter(x=>matchesMugshot(x,q)).map(x=>x.song).sort();
  for(const [a,b] of [['tv','television'],['actor','actress'],['comedy','comedian'],['sport','sports']])assert.deepEqual(slugs(a),slugs(b));
  for(const [name,query] of [['Ronan Keating','music'],['Mo Gilligan','comedy'],['Darcey Bussell','dance'],['Ainsley Harriott','cooking'],['Edele Lynch','music']])assert.ok(matchesMugshot(find(name),query));
});
test('curated show, band, nickname and historical aliases remain searchable', () => {
  for(const [name,q] of [['Mark Labbett','The Beast'],['Faye Tozer','Steps'],['Ronan Keating','Boyzone'],['Colin Baker','Doctor Who'],['Amy Dowden','Strictly'],['Steve McFadden','EastEnders'],['Brooke Vincent','Coronation Street'],['Dan Walker','Dan Wallker']])assert.ok(matchesMugshot(find(name),q),name);
  assert.ok(!matchesMugshot(find('Edele Lynch'),'Boyzone'),'incidental brother mention is not a band membership');
});
test('category dropdown counts and selected results agree; names remain precise', () => {
  for(const q of ['sport','music','tv','comedy','football','actor','dance','radio']) {
    const options=mugshotSuggestions(catalogue,q); assert.ok(options.length<=8);
    assert.equal(new Set(options.map(x=>x.id)).size,options.length);
    for(const option of options){const matches=catalogue.filter(x=>matchesMugshot(x,option.label,option)); assert.ok(matches.length);if(option.type==='category')assert.equal(matches.length,option.count);if(option.type==='name')assert.deepEqual(matches.map(x=>x.song),[option.slug]);}
  }
  assert.equal(mugshotSuggestions(catalogue,'sport')[0].label,'Sport');
});
