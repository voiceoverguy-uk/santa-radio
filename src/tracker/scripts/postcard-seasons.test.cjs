const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(file) {
  const full = path.resolve(root, file);
  if (cache.has(full)) return cache.get(full);
  if (full.endsWith(".json")) return JSON.parse(fs.readFileSync(full, "utf8"));
  if (full.endsWith(".css")) return {};
  const exports = {};
  cache.set(full, exports);
  const js = ts.transpileModule(fs.readFileSync(full, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(js, { exports, Date, Intl, console, require(spec) {
    if (!spec.startsWith(".") && !spec.startsWith("@/")) return require(spec);
    let target = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(full), spec);
    if (!path.extname(target)) target += [".ts", ".tsx", ".js"].find(ext => fs.existsSync(target + ext));
    return load(path.relative(root, target));
  }}, { filename: full });
  return exports;
}
const {getPostcardSeason} = load("lib/postcardSeason.ts");
const messages = load("data/seasonalPostcards.json");
test("postcards follow route and New Year boundaries", () => {
  for (const [iso, expected] of [
    ["2026-11-09T23:59:59Z","holiday"], ["2026-11-10T00:00:00Z","planning"],
    ["2026-12-22T23:59:59Z","planning"], ["2026-12-23T00:00:00Z","workshop"],
    ["2026-12-24T09:59:59Z","workshop"], ["2026-12-24T10:00:00Z","delivery"],
    ["2026-12-25T11:19:59Z","delivery"], ["2026-12-25T11:20:00Z","rest"],
    ["2026-12-31T17:59:59Z","rest"], ["2026-12-31T18:00:00Z","party"],
    ["2027-01-01T02:59:59Z","party"], ["2027-01-01T03:00:00Z","recovery"],
    ["2027-01-02T00:00:00Z","holiday"]
  ]) assert.equal(getPostcardSeason(new Date(iso)),expected,iso);
});
test("requested message sets are complete and distinct", () => {
  for (const [key,count] of Object.entries({planning:30,workshop:1,delivery:10,rest:30,party:30,recovery:20,holidayExtra:25})) {
    assert.equal(messages[key].length,count,key);
    assert.equal(new Set(messages[key]).size,count,key);
  }
});

test("100 delivery postcards match all route regions without leaking countries", () => {
 const cards=load("data/deliveryPostcards.json");
 const itinerary=load("data/santaItinerary.json");
 const route=load("lib/santaRoute.ts");
 const stops=load("data/santaRouteStops.ts");
 const {getDeliveryPostcards}=load("lib/deliveryPostcards.ts");
 assert.equal(cards.length,100);assert.equal(new Set(cards.map(x=>x.message)).size,100);
 for(const region of new Set(itinerary.map(p=>p.mapRegion)))assert.ok(cards.some(c=>c.region===region),region);
 for(const {stop,arrival} of stops.getScheduledStops(2026)){
   const now=new Date(arrival.getTime()+1000);const actual=route.getCurrentStop(now);
   const place=itinerary.find(p=>p.id===actual.id);const selected=getDeliveryPostcards(now);
   for(const text of selected.messages){const c=cards.find(c=>c.message===text);assert.ok(c);if(c.countryCode)assert.equal(c.countryCode,place.countryCode);if(c.region)assert.equal(c.region,place.mapRegion);}
 }
 const between=new Date(stops.getStopDepartureDate(stops.santaStops[0],2026).getTime()+1);
 if(getDeliveryPostcards(between).key==='transit') assert.ok(getDeliveryPostcards(between).messages.every(text=>cards.some(c=>c.message===text&&!c.countryCode&&!c.region)));
});
