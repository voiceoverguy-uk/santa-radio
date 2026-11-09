const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(file) {
  const full = path.resolve(root, file);
  if (cache.has(full)) return cache.get(full);
  if (full.endsWith(".json")) return JSON.parse(fs.readFileSync(full, "utf8"));
  const exports = {};
  cache.set(full, exports);
  const js = ts.transpileModule(fs.readFileSync(full, "utf8"), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
  }}).outputText;
  vm.runInNewContext(js, { exports, Date, Intl, console, require(spec) {
    let target = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(full), spec);
    if (!path.extname(target)) target += ".ts";
    return load(path.relative(root, target));
  }}, { filename: full });
  return exports;
}
const data = load("data/santaRouteStops.ts");
const route = load("lib/santaRoute.ts");
const preview = load("lib/santaPreview.ts");
const camera = load("components/trackerCamera.ts");
const raw = load("data/santaItinerary.json");

test("December North Pole visits use UTC boundaries and an exact one-in-four choice", () => {
  const messages = route.decemberNorthPoleMessages;
  assert.equal(messages.length, 5);
  assert.equal(route.isDecemberVisitSeason(new Date("2026-11-30T23:59:59.999Z")), false);
  assert.equal(route.isDecemberVisitSeason(new Date("2026-12-01T00:00:00Z")), true);
  assert.equal(route.isDecemberVisitSeason(new Date("2026-12-23T23:59:59.999Z")), true);
  assert.equal(route.isDecemberVisitSeason(new Date("2026-12-24T00:00:00+01:00")), true);
  assert.equal(route.isDecemberVisitSeason(new Date("2026-12-23T23:30:00-01:00")), false);
  assert.equal(route.isDecemberVisitSeason(new Date("2026-12-24T00:00:00Z")), false);
  assert.equal(route.isDecemberVisitSeason(new Date("2027-01-01T00:00:00Z")), false);

  for (const value of [0, 0.249999]) {
    const randomValues = [value, 0];
    const visit = route.getRandomDecemberTrackerVisit(() => randomValues.shift());
    assert.equal(visit.kind, "NORTH_POLE");
    assert.equal(visit.message, messages[0]);
  }
  for (const value of [0.25, 0.999999]) {
    assert.equal(route.getRandomDecemberTrackerVisit(() => value).kind, "ROUTE_RESEARCH");
  }
  for (let i = 0; i < messages.length; i++) {
    const randomValues = [0, i / messages.length];
    const visit = route.getRandomDecemberTrackerVisit(() => randomValues.shift());
    assert.equal(visit.kind, "NORTH_POLE");
    assert.equal(visit.message, messages[i]);
  }
});

test("all 290 supplied destinations have unique identities, coordinates and real time zones", () => {
  assert.equal(raw.length, 290);
  assert.equal(new Set(raw.map(p => p.id)).size, 290);
  assert.equal(new Set(raw.map(p => p.name)).size, 290);
  for (const p of raw) {
    assert.ok(p.lat >= -90 && p.lat <= 90, p.name);
    assert.ok(p.lng >= -180 && p.lng <= 180, p.name);
    assert.ok(p.geonameId > 0, p.name);
    assert.doesNotThrow(() => new Intl.DateTimeFormat("en", { timeZone: p.timeZone }));
  }
  // Check list coverage independently against the owner's original input when available.
  const supplied = path.resolve(root, "../../../attached_assets/Pasted--1-The-Pacific-Islands-starting-point-START-1-Kiritimat_1794169827669.txt");
  if (fs.existsSync(supplied)) {
    const headings = new Set(["The Pacific Islands – starting point", "New Zealand", "Australia", "East Asia", "Southeast Asia", "South Asia", "Central Asia", "Middle East", "Europe", "Africa", "South America", "Central America and the Caribbean", "North America", "Antarctica – special delivery"]);
    const names = fs.readFileSync(supplied, "utf8").split("\n").filter(line => /^\s*\d/.test(line))
      .map(line => line.replace(/^[\s\d.\u2060]+/, "").trim()).filter(name => !headings.has(name));
    assert.deepEqual(raw.map(p => p.name).sort(), names.sort());
  }
});

for (const year of [2026, 2027, 2028]) {
  test(`${year}: all 290 stops get their own local-night visit and nonzero travel slot`, () => {
    const schedule = data.getScheduledStops(year);
    assert.equal(schedule.length, 290);
    assert.equal(schedule[0].stop.id, "kiritimati");
    assert.equal(schedule.at(-1).stop.id, "honolulu");
    for (let i = 0; i < schedule.length; i++) {
      const { stop, arrival, departure } = schedule[i];
      assert.equal(route.getCurrentStopId(arrival), stop.id, `${stop.name} is never skipped`);
      assert.equal(route.getVisitedStops(arrival).size, i + 1);
      const localHour = (data.getStopArrivalUtcHour(stop, year) + data.getStopUtcOffset(stop, year)) % 24;
      assert.ok(localHour >= 0 && localHour < 1, `${stop.name}: ${localHour}`);
      assert.ok(departure > arrival, stop.name);
      const next = schedule[i + 1];
      if (next) {
        assert.ok(next.arrival > departure, stop.name);
        assert.equal(route.getNextStop(arrival).id, next.stop.id);
        const midpoint = new Date((departure.getTime() + next.arrival.getTime()) / 2);
        const pos = route.getInterpolatedMapPosition(midpoint);
        assert.ok(Number.isFinite(pos.x) && Number.isFinite(pos.y));
        assert.ok(pos.x >= 0 && pos.x <= 100 && pos.y >= 0 && pos.y <= 100);
        assert.notEqual(pos.lat, stop.lat, `Santa leaves ${stop.name}`);
      }
    }
    const completed = route.getDashboardData(new Date(Date.UTC(year, 11, 25, 11, 20)));
    assert.equal(completed.mode, "COMPLETE");
    assert.equal(completed.visitedCount, 290);
    assert.equal(completed.remainingCount, 0);
    assert.match(completed.statusSubtext, /Honolulu/);
    assert.equal(route.getDashboardData(new Date(Date.UTC(year, 11, 26))).visitedCount, 0);
  });
}

test("regional cameras include every pin, including both sides of the Pacific", () => {
  for (const region of camera.MAP_REGIONS) {
    const frame = camera.regionCamera(region.name);
    for (const stop of data.santaStops.filter(s => s.mapRegion === region.name)) {
      const p = camera.project(stop.lat, stop.lng);
      if (region.name === "Pacific" && p.x < 500) p.x += 1000;
      assert.ok(Math.abs(p.x - frame.cx) <= frame.w / 2 + .01, `${region.name}: ${stop.name} x`);
      assert.ok(Math.abs(p.y - frame.cy) <= frame.w / 4 + .01, `${region.name}: ${stop.name} y`);
    }
  }
});

test("preview can reach every city and full run speed preserves the journey boundaries", () => {
  for (const stop of data.santaStops) {
    assert.equal(preview.getJumpTime(`city:${stop.id}`).getTime(), data.getStopArrivalDate(stop, new Date().getUTCFullYear()).getTime());
  }
  assert.throws(() => preview.getJumpTime("city:unknown"), /Unknown itinerary/);
  assert.ok(Math.abs(preview.getRunFullJourneySpeed(2) * 120000 - (25 * 60 + 25) * 60000) < .1);
});

test("Christmas Eve has its own dated shortcut without changing departure or Christmas Day end", () => {
  assert.ok(preview.JUMP_LABELS.some(({ target, label }) => target === "christmas-eve-start" && label === "24 December"));
  const year = new Date().getUTCFullYear();
  assert.equal(preview.getJumpTime("christmas-eve-start").getTime(), Date.UTC(year, 11, 24, 9));
  assert.equal(preview.getJumpTime("route-start").getTime(), Date.UTC(year, 11, 24, 9, 55));
  assert.equal(preview.getJumpTime("christmas-day-end").getTime(), Date.UTC(year, 11, 25, 23, 59));
});
