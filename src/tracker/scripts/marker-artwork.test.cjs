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
  } }, { filename: full });
  return exports;
}
const route = load("lib/santaRoute.ts");
const { getSantaMarkerArtwork: artwork } = load("lib/santaMarker.ts");
const { getScheduledStops } = load("data/santaRouteStops.ts");
const SantaMap = load("components/SantaMap.tsx").default;

test("UTC seasonal boundaries never dress preparation or completion as a trip", () => {
  for (const [iso, mode, file] of [
    ["2026-11-09T23:59:59.999Z", "OFF_SEASON", "holiday"],
    ["2026-11-10T00:00:00Z", "ROUTE_RESEARCH", "route-scout"],
    ["2026-12-22T23:59:59.999Z", "ROUTE_RESEARCH", "route-scout"],
    ["2026-12-23T00:00:00Z", "PREPARING", null],
    ["2026-12-24T09:59:59.999Z", "PREPARING", null],
    ["2026-12-24T10:00:00Z", "LIVE", "sleigh-left"],
    ["2026-12-25T11:19:59.999Z", "LIVE", "sleigh-left"],
    ["2026-12-25T11:20:00Z", "COMPLETE", null],
    ["2026-12-25T23:59:59.999Z", "COMPLETE", null],
    ["2026-12-26T00:00:00Z", "OFF_SEASON", "holiday"],
    ["2027-01-01T00:00:00Z", "OFF_SEASON", "holiday"],
  ]) {
    assert.equal(route.getSeasonalTrackerMode(new Date(iso)), mode, iso);
    const result = artwork(mode, -10);
    assert.equal(result?.src ?? null, file ? `/images/tracker/santa-${file}.png` : null, iso);
  }
});

test("both outfits use geographic west/original, east/mirror and exact Greenwich/front", () => {
  for (const [mode, name] of [["OFF_SEASON", "holiday"], ["ROUTE_RESEARCH", "route-scout"]]) {
    for (const lng of [-179, -0.001, 0, -0, 0.001, 179]) {
      const result = artwork(mode, lng);
      assert.equal(result.src, `/images/tracker/santa-${name}${lng === 0 ? "-front" : ""}.png`);
      assert.equal(result.mirrored, lng > 0);
    }
  }
});

test("shortest longitude uses interpolation's convention across both sides of the date line", () => {
  for (const [from, to, delta] of [[179, -179, 2], [-179, 179, -2], [10, 20, 10], [20, 10, -10], [10, 10, 0]]) {
    assert.equal(route.shortestLongitudeDelta(from, to), delta);
  }
});

test("every chronological leg uses its direction in transit and holds it during arrival dwell, even after time jumps", () => {
  const schedule = getScheduledStops(2026);
  let east = 0, west = 0, crossings = 0;
  // Reverse traversal deliberately tests history-independent preview jumps.
  for (let i = schedule.length - 2; i >= 0; i--) {
    const from = schedule[i], to = schedule[i + 1];
    const raw = to.stop.lng - from.stop.lng;
    const delta = Math.abs(raw) > 180 ? raw + (raw > 0 ? -360 : 360) : raw;
    const expected = delta > 0 ? "right" : "left";
    if (delta > 0) east++; else west++;
    if (Math.abs(raw) > 180) crossings++;
    for (const ms of [
      from.departure.getTime() + 1,
      (from.departure.getTime() + to.arrival.getTime()) / 2,
      to.arrival.getTime(),
      to.departure.getTime(),
    ]) {
      const now = new Date(ms);
      assert.equal(route.getJourneySleighDirection(now), expected, `${from.stop.id} → ${to.stop.id} at ${now.toISOString()}`);
      assert.equal(artwork("LIVE", 0, expected).src, `/images/tracker/santa-sleigh${expected === "left" ? "-left" : ""}.png`);
    }
  }
  assert.ok(east > 0 && west > 0 && crossings > 0);
  assert.equal(route.getJourneySleighDirection(schedule[0].arrival), "left");
  assert.equal(route.getJourneySleighDirection(new Date("2026-12-23T12:00:00Z")), "left");
});

test("meridional legs and absent usable legs default left", () => {
  const schedule = getScheduledStops(2026);
  const from = schedule[0], to = schedule[1];
  const old = to.stop.lng;
  try {
    to.stop.lng = from.stop.lng;
    assert.equal(route.getJourneySleighDirection(new Date(from.departure.getTime() + 1)), "left");
  } finally { to.stop.lng = old; }
  assert.equal(route.getJourneySleighDirection(new Date("invalid")), "left");
});

test("rendered full map anchors an independently mirrored, proportion-preserving image", () => {
  for (const [iso, outfit] of [["2026-11-09T12:00:00Z", "holiday"], ["2026-11-10T12:00:00Z", "route-scout"]]) {
    for (const lng of [-30, 0, 30]) {
      const html = renderToStaticMarkup(React.createElement(SantaMap, {
        effectiveTime: new Date(iso),
        mapPosition: { lat: 10, lng, x: (lng + 180) / 3.6, y: 80 / 1.8 },
        onHoliday: outfit === "holiday",
        researchDestination: outfit === "route-scout" ? { name: "Test", activity: "Reading maps" } : null,
      }));
      assert.match(html, new RegExp(`santa-${outfit}${lng === 0 ? "-front" : ""}\\.png`));
      assert.match(html, /preserveAspectRatio="xMidYMid meet"/);
      assert.equal(html.includes('transform="scale(-1 1)"'), lng > 0);
      assert.match(html, /class="tj-santa(?: tj-santa-trigger)?" data-santa-lat="[^"]+" data-santa-lng="[^"]+" transform="translate/);
      assert.doesNotMatch(html, /Fictional estimated itinerary|GeoNames \(CC BY\)|tj-source/);
      assert.match(html, /aria-label="Map camera"/);
    }
  }
});

test("all six stable PNG assets retain source proportions and an RGBA alpha channel", () => {
  const assets = fs.readdirSync(path.resolve(root, "../../public/images/tracker"));
  assert.equal(assets.length, 6);
  for (const name of assets) {
    const source = fs.readdirSync(path.resolve(root, "../../attached_assets")).find(file => file.startsWith(name.replace(".png", "_")));
    const png = fs.readFileSync(path.resolve(root, "../../public/images/tracker", name));
    const original = fs.readFileSync(path.resolve(root, "../../attached_assets", source));
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.equal(png[25], 6, name);
    assert.equal(Math.max(w, h), 256);
    assert.ok(Math.abs(w / h - original.readUInt32BE(16) / original.readUInt32BE(20)) < 0.005, name);
  }
});
