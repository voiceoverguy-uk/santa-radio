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
const data = load("data/santaRouteStops.ts");
const route = load("lib/santaRoute.ts");
const preview = load("lib/santaPreview.ts");
const { santaStops: stops } = data;

test("290 destinations all carry concise fictional antics, geographic facts and time-zone metadata", () => {
  assert.equal(stops.length, 290);
  for (const stop of stops) {
    assert.ok(stop.activity.length > 30 && stop.activity.length < 160, stop.id);
    assert.ok(stop.funFact && stop.timeZone && stop.flag && stop.displayLabel, stop.id);
  }
  assert.equal(stops.filter(s => s.milestoneType === "end").length, 1);
});

test("fractional Christmas clocks remain factual while cities receive distinct estimated arrivals", () => {
  for (const year of [2026, 2027, 2028, 2029, 2030]) {
    assert.equal(data.getStopUtcOffset(stops.find(s => s.id === "adelaide"), year), 10.5);
    assert.equal(data.getStopUtcOffset(stops.find(s => s.id === "kathmandu"), year), 5.75);
    const scheduled = data.getScheduledStops(year);
    assert.equal(new Set(scheduled.map(s => s.arrival.getTime())).size, 290);
    for (const { stop, arrival } of scheduled) {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: stop.timeZone, day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(arrival);
      assert.equal(parts.find(p => p.type === "day").value, "25", stop.id);
      assert.equal(parts.find(p => p.type === "hour").value, "00", stop.id);
    }
  }
});

test("all arrivals keep selected facts, activities, counts and map positions aligned", () => {
  for (const { stop, arrival } of data.getScheduledStops(2026)) {
    const dashboard = route.getDashboardData(arrival);
    assert.equal(route.getCurrentStopId(arrival), stop.id);
    assert.equal(dashboard.currentActivity, stop.activity);
    assert.equal(dashboard.currentFunFact, stop.funFact);
    assert.equal(dashboard.activityPlace, stop.name);
    assert.equal(dashboard.mapPosition.lat, stop.lat);
    assert.equal(dashboard.mapPosition.lng, stop.lng);
    assert.equal(dashboard.visitedCount + dashboard.remainingCount, 290);
  }
  const london = stops.find(s => s.id === "london");
  assert.equal(route.getSantaTrackerState(data.getStopArrivalDate(london, 2026)), "UK_SPECIAL_WINDOW");
  assert.equal(route.getDashboardData(new Date("2026-12-24T23:30:00Z")).approachingUK, true);
});

test("preview city jumps and accelerated journey reach completion without changing its final window", () => {
  const end = preview.getJumpTime("complete");
  assert.equal(end.getUTCHours(), 11);
  assert.equal(end.getUTCMinutes(), 20);
  for (const minutes of [2, 5, 10]) assert.equal(preview.getJumpTime("route-start").getTime() + preview.getRunFullJourneySpeed(minutes) * minutes * 60000, end.getTime());
  assert.equal(route.getVisitedStops(new Date("2026-12-25T11:20:00Z")).size, 290);
});

test("server-rendered map and bounded searchable timeline contain all 290 stops", () => {
  const now = new Date("2026-12-24T18:16:00Z");
  const Map = load("components/SantaMap.tsx").default;
  const Timeline = load("components/SantaTimeline.tsx").default;
  const map = renderToStaticMarkup(React.createElement(Map, { effectiveTime: now, mapPosition: route.getInterpolatedMapPosition(now) }));
  const timeline = renderToStaticMarkup(React.createElement(Timeline, { effectiveTime: now }));
  assert.equal((map.match(/data-stop-id=/g) || []).length, 290);
  assert.equal((timeline.match(/data-santa-activity=/g) || []).length, 290);
  assert.match(timeline, /Search destinations|Search 290 stops/);
  for (const stop of stops) {
    assert.ok(map.includes(`data-stop-id="${stop.id}"`));
    assert.ok(timeline.includes(`data-santa-activity="${stop.id}"`));
  }
});

test("the expanded delivery itinerary does not add holiday destinations or change seasons", () => {
  const source = fs.readFileSync(path.join(root, "components/SantaStory.tsx"), "utf8");
  assert.equal((source.match(/}, 15000\)/g) || []).length, 2);
  assert.equal(load("data/christmasFacts.ts").additionalChristmasFacts.length, 12);
  assert.equal(load("data/santaHolidays.ts").holidayDestinations.length, 91);
  assert.ok(route.isHolidaySeason(new Date("2026-11-09T23:59:59Z")));
  assert.ok(route.isRouteResearchSeason(new Date("2026-12-01T00:00:00Z")));
  assert.ok(route.isDecemberPrep(new Date("2026-12-23T00:00:00Z")));
  assert.ok(route.isChristmasInJuly(new Date("2026-07-15T12:00:00Z")));
});
