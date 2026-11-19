import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import raw from '../src/data/mugshots.json' with {type:'json'};
import labels from '../src/data/mugshot-card-labels.json' with {type:'json'};
import {buildCatalogue} from '../src/data/mugshot-catalogue.js';
const rows=buildCatalogue(raw).catalogue;
assert.equal(Object.keys(labels).length,rows.filter(x=>x.kind!=='feature').length);
assert.equal(rows.find(x=>x.artist==='Scott Mills').homepage,false);
assert.equal(rows.find(x=>x.artist==='David Mitchell').cardLabel,'Actor & Comedian');
const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {for(const width of [320,390,1170,1466]){
const p=await b.newPage({viewport:{width,height:1000}});await p.goto((process.env.TEST_ORIGIN||'http://127.0.0.1:5009')+'/');await p.evaluate(()=>document.fonts.ready);
const result=await p.locator('.mug-info span:not(.mugshots-card-arrow)').first().evaluate((el,labels)=>{const style=getComputedStyle(el);const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');ctx.font=style.font;const available=el.getBoundingClientRect().width;return {available,font:style.font,tooWide:[...new Set(labels)].filter(x=>ctx.measureText(x).width>available)}},Object.values(labels));
assert.deepEqual(result.tooWide,[],`Labels overflow at ${width}px`);console.log(width,JSON.stringify(result));await p.close();}}
finally {await b.close();}
