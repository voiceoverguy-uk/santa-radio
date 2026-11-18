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
    ["2026-12-23T00:00:00Z", "PREPARING", "traditional-front"],
    ["2026-12-24T09:59:59.999Z", "PREPARING", "traditional-front"],
    ["2026-12-24T10:00:00Z", "LIVE", "sleigh-left"],
    ["2026-12-25T11:19:59.999Z", "LIVE", "sleigh-left"],
    ["2026-12-25T11:20:00Z", "COMPLETE", "traditional-front"],
    ["2026-12-25T23:59:59.999Z", "COMPLETE", "traditional-front"],
    ["2026-12-26T00:00:00Z", "COMPLETE", "traditional-front"],
    ["2027-01-01T00:00:00Z", "COMPLETE", "traditional-front"],
    ["2027-01-02T00:00:00Z", "OFF_SEASON", "holiday"],
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

test("tracker PNG assets retain source proportions and an RGBA alpha channel", () => {
  const assets = fs.readdirSync(path.resolve(root, "../../public/images/tracker"));
  assert.equal(assets.length, 10);
  for (const name of assets) {
    const source = fs.readdirSync(path.resolve(root, "../../attached_assets")).find(file => file.startsWith(name.replace(".png", "_")));
    const png = fs.readFileSync(path.resolve(root, "../../public/images/tracker", name));
    const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.equal(png[25], 6, name);
    assert.equal(Math.max(w, h), 256);
    if (source) {
      const original = fs.readFileSync(path.resolve(root, "../../attached_assets", source));
      assert.ok(Math.abs(w / h - original.readUInt32BE(16) / original.readUInt32BE(20)) < 0.005, name);
    } else {
      assert.ok(["santa-traditional-front.png", "santa-shattered.png", "santa-armchair.png", "santa-party.png"].includes(name));
    }
  }
});


test("post-Christmas rest and New Year celebration follow the device timezone across UTC rollover", () => {
  const post = load("lib/postChristmas.ts");
  const preview = load("lib/santaPreview.ts");
  const previousZone = process.env.TZ;
  try {
    for (const zone of ["Europe/London", "America/Los_Angeles", "Pacific/Kiritimati", "Asia/Kathmandu", "Australia/Eucla", "Pacific/Chatham", "America/St_Johns", "Pacific/Marquesas"]) {
      process.env.TZ = zone;
      const before = new Date(2026, 11, 31, 17, 59, 59);
      const start = new Date(2026, 11, 31, 18);
      const end = new Date(2027, 0, 1, 2, 59, 59);
      const january = new Date(2027, 0, 2);
      for (const date of [new Date("2026-12-25T11:20:00Z"), new Date(2026, 11, 26, 12), before]) {
        const data = route.getDashboardData(date);
        assert.equal(data.mode, "COMPLETE", `${zone} ${date.toISOString()}`);
        assert.equal(data.currentStopName, "North Pole grotto");
        assert.equal(data.mapPosition.lat, 90);
        assert.equal(data.mapPosition.lng, 0);
        assert.ok(post.restCaptions.includes(data.statusSubtext));
      }
      for (const date of [start, end]) {
        const data = route.getDashboardData(date);
        const city = post.getNewYearCity(date);
        assert.equal(data.mode, "COMPLETE", zone);
        assert.match(data.statusHeadline, /Ringing in the New Year/);
        assert.equal(data.mapPosition.lat, city.lat);
        assert.equal(data.mapPosition.lng, city.lng);
        assert.equal(data.progressPercent, 100);
        assert.equal(data.visitedCount, 290);
        assert.deepEqual(post.getDeviceDateParts(date, city.timeZone), post.getDeviceDateParts(date));
      }
      assert.equal(post.getNewYearCity(start).id, post.getNewYearCity(end).id);
      for (const date of [new Date(2027, 0, 1, 3), new Date(2027, 0, 1, 23, 59, 59)]) {
        const resting = route.getDashboardData(date);
        assert.equal(resting.mode, "COMPLETE", zone);
        assert.equal(resting.currentStopName, "North Pole grotto", zone);
        assert.equal(resting.mapPosition.lat, 90);
        assert.equal(resting.mapPosition.lng, 0);
        assert.ok(post.restCaptions.includes(resting.statusSubtext));
      }
      assert.equal(route.getSeasonalTrackerMode(january), "OFF_SEASON", zone);
      assert.equal(route.isHolidaySeason(january), true, zone);
      const jump = preview.getJumpTime("new-years-eve");
      assert.equal(jump.getHours(), 18);
      assert.equal(jump.getDate(), 31);
      assert.equal(route.getSeasonalTrackerMode(new Date("2026-12-25T11:19:59.999Z")), "LIVE");
    }
    assert.equal(post.restCaptions.length, 10);
    assert.equal(new Set(post.restCaptions).size, 10);
    assert.equal(preview.JUMP_LABELS.filter(entry => /December/.test(entry.label)).length, 3);
    assert.ok(!preview.JUMP_LABELS.some(entry => /November/.test(entry.label)));
    assert.equal(route.getSeasonalTrackerMode(preview.getJumpTime("route-start")), "LIVE");
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});


test("traditional Santa waits at the North Pole until takeoff with ten preparation captions", () => {
  const post = load("lib/postChristmas.ts");
  assert.equal(post.preparationCaptions.length, 10);
  assert.equal(new Set(post.preparationCaptions).size, 10);
  for (const iso of ["2026-12-24T00:00:00Z", "2026-12-24T09:59:59.999Z"]) {
    const data = route.getDashboardData(new Date(iso));
    assert.equal(data.mode, "PREPARING");
    assert.equal(data.mapPosition.lat, 90);
    assert.equal(data.mapPosition.lng, 0);
    assert.match(artwork(data.mode, 0).src, /santa-traditional-front/);
    assert.ok(post.preparationCaptions.includes(data.statusSubtext));
  }
  const departure = route.getDashboardData(new Date("2026-12-24T10:00:00Z"));
  assert.equal(departure.mode, "LIVE");
  assert.match(artwork(departure.mode, departure.mapPosition.lng).src, /santa-sleigh/);
});


test("map clears delivery lines and visited pin styling immediately after the final delivery", () => {
  for (const [iso, hasRoute] of [
    ["2026-12-25T11:19:59.999Z", true],
    ["2026-12-25T11:20:00Z", false],
    ["2026-12-31T20:00:00Z", false],
    ["2027-01-01T12:00:00Z", false],
  ]) {
    const effectiveTime = new Date(iso);
    const data = route.getDashboardData(effectiveTime);
    const html = renderToStaticMarkup(React.createElement(SantaMap, {
      effectiveTime, mapPosition: data.mapPosition,
    }));
    assert.equal(html.includes("stroke-dasharray"), hasRoute, iso);
    assert.equal(html.includes('fill="#b62332"'), hasRoute, iso);
    assert.match(html, /data-santa-artwork/);
  }
});


test("rest sprites switch exactly eight hours after delivery and preserve the New Year outfit", () => {
  const previousZone = process.env.TZ;
  process.env.TZ = "Europe/London";
  try {
    for (const [iso, sprite] of [
      ["2026-12-25T11:19:59.999Z", "sleigh"],
      ["2026-12-25T11:20:00Z", "shattered"],
      ["2026-12-25T19:19:59.999Z", "shattered"],
      ["2026-12-25T19:20:00Z", "armchair"],
      ["2026-12-31T17:59:59Z", "armchair"],
      ["2026-12-31T18:00:00Z", "party"],
      ["2027-01-01T02:59:59Z", "party"],
      ["2027-01-01T03:00:00Z", "armchair"],
      ["2027-01-01T23:59:59Z", "armchair"],
      ["2027-01-02T00:00:00Z", "holiday-front"],
    ]) {
      const date = new Date(iso);
      const data = route.getDashboardData(date);
      const marker = artwork(data.mode, 0, "left", date);
      assert.ok(marker.src.includes(`santa-${sprite}`), iso);
      assert.equal(marker.mirrored, false);
      const html = renderToStaticMarkup(React.createElement(SantaMap, {
        effectiveTime: date, mapPosition: data.mapPosition,
      }));
      assert.ok(html.includes(`santa-${sprite}`), iso);
    }
  } finally {
    if (previousZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousZone;
  }
});
