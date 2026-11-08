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
  const exports = {};
  cache.set(full, exports);
  const js = ts.transpileModule(fs.readFileSync(full, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(js, {
    exports, Date, Intl, console,
    require(spec) {
      if (!spec.startsWith(".") && !spec.startsWith("@/")) return require(spec);
      let target = spec.startsWith("@/") ? path.join(root, spec.slice(2)) : path.resolve(path.dirname(full), spec);
      if (!path.extname(target)) target += [".ts", ".tsx", ".js"].find(ext => fs.existsSync(target + ext));
      return load(path.relative(root, target));
    },
  }, { filename: full });
  return exports;
}
const data = load("data/santaRouteStops.ts");
const route = load("lib/santaRoute.ts");
const preview = load("lib/santaPreview.ts");
const { santaStops: stops, getStopUtcOffset: offset, getStopArrivalDate: arrival } = data;
const originalIds = "pacific fiji new-zealand australia japan south-korea china philippines singapore indonesia thailand bangladesh india pakistan middle-east east-africa turkey greece south-africa eastern-europe italy germany netherlands switzerland spain france scandinavia uk ireland iceland west-africa south-america-east argentina peru caribbean canada-east eastern-usa florida central-usa mexico mountain-usa west-coast alaska hawaii".split(" ");
const additions = {
  "chatham-islands": [13.75, "2026-12-24T10:15:00.000Z"],
  adelaide: [10.5, "2026-12-24T13:30:00.000Z"],
  brisbane: [10, "2026-12-24T14:00:00.000Z"],
  darwin: [9.5, "2026-12-24T14:30:00.000Z"],
  eucla: [8.75, "2026-12-24T15:15:00.000Z"],
  yangon: [6.5, "2026-12-24T17:30:00.000Z"],
  kathmandu: [5.75, "2026-12-24T18:15:00.000Z"],
  kabul: [4.5, "2026-12-24T19:30:00.000Z"],
  tehran: [3.5, "2026-12-24T20:30:00.000Z"],
  rovaniemi: [2, "2026-12-24T22:00:00.000Z"],
  azores: [-1, "2026-12-25T01:00:00.000Z"],
  "fernando-de-noronha": [-2, "2026-12-25T02:00:00.000Z"],
  newfoundland: [-3.5, "2026-12-25T03:30:00.000Z"],
  barbados: [-4, "2026-12-25T04:00:00.000Z"],
  "marquesas-islands": [-9.5, "2026-12-25T09:30:00.000Z"],
  "american-samoa": [-11, "2026-12-25T11:00:00.000Z"],
};
test("60 unique stops retain all original IDs and have 60 distinct concise activities", () => {
  assert.equal(stops.length, 60);
  assert.equal(new Set(stops.map(s => s.id)).size, 60);
  assert.equal(new Set(stops.map(s => s.activity)).size, 60);
  for (const id of originalIds) assert.ok(stops.some(s => s.id === id), id);
  for (const stop of stops) {
    assert.ok(stop.activity.length > 30 && stop.activity.length < 160, stop.id);
    assert.ok(stop.funFact && stop.timeZone && stop.flag && stop.displayLabel, stop.id);
    assert.ok(Math.abs(stop.lat) <= 90 && Math.abs(stop.lng) <= 180, stop.id);
  }
  assert.equal(stops[0].id, "pacific");
  assert.equal(stops.at(-1).id, "american-samoa");
  assert.equal(stops.filter(s => s.milestoneType === "end").length, 1);
});
test("37 represented Christmas offsets follow IANA local midnight, including all 16 additions", () => {
  for (const year of [2026, 2027, 2028, 2029, 2030]) {
    assert.equal(new Set(stops.map(s => offset(s, year))).size, 37);
    let previous = 0;
    for (const stop of stops) {
      const at = arrival(stop, year);
      assert.ok(at.getTime() >= previous, stop.id);
      previous = at.getTime();
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: stop.timeZone, day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
      for (const [type, expected] of [["day", "25"], ["hour", "00"], ["minute", "00"]]) assert.equal(parts.find(p => p.type === type).value, expected, stop.id);
    }
    for (const [id, [expected]] of Object.entries(additions)) assert.equal(offset(stops.find(s => s.id === id), year), expected, id);
  }
  for (const [id, [, expected]] of Object.entries(additions)) assert.equal(arrival(stops.find(s => s.id === id), 2026).toISOString(), expected, id);
  assert.equal(data.formatStopOffset(stops.find(s => s.id === "chatham-islands"), 2026), "UTC+13:45");
});
test("new arrivals, shared offsets and UK priority use matching facts, activities, counts and markers", () => {
  for (const [id, [, iso]] of Object.entries(additions)) {
    const now = new Date(new Date(iso).getTime() + 60000);
    const stop = stops.find(s => s.id === id);
    const dashboard = route.getDashboardData(now);
    assert.equal(route.getCurrentStopId(now), id, id);
    assert.equal(dashboard.currentActivity, stop.activity);
    assert.equal(dashboard.currentFunFact, stop.funFact);
    assert.equal(dashboard.activityPlace, stop.name);
    assert.equal(dashboard.mapPosition.lat, stop.lat);
    assert.equal(dashboard.mapPosition.lng, stop.lng);
    assert.equal(dashboard.visitedCount, route.getVisitedStops(now).size);
    assert.equal(dashboard.visitedCount + dashboard.remainingCount, 60);
  }
  for (const iso of ["2026-12-25T00:00:00Z", "2026-12-25T00:49:59Z"]) {
    const now = new Date(iso);
    assert.equal(route.getCurrentStopId(now), "uk");
    assert.equal(route.getDashboardData(now).activityPlace, "United Kingdom");
    assert.equal(route.getInterpolatedMapPosition(now).lat, 51.5);
    assert.equal(route.getSantaTrackerState(now), "UK_SPECIAL_WINDOW");
  }
  assert.equal(route.getDashboardData(new Date("2026-12-24T23:30:00Z")).approachingUK, true);
});
test("fractional segments stay finite, use the selected stop's dwell, and reach Samoa before completion", () => {
  for (let ms = Date.parse("2026-12-24T09:59:00Z"); ms <= Date.parse("2026-12-25T11:21:00Z"); ms += 60000) {
    const now = new Date(ms);
    const position = route.getInterpolatedMapPosition(now);
    assert.ok(Object.values(position).every(Number.isFinite), now.toISOString());
    const current = route.getCurrentStop(now);
    if (current && route.getSantaTrackerState(now) !== "UK_SPECIAL_WINDOW") {
      const dwelling = ms < arrival(current, 2026).getTime() + current.dwellMinutes * 60000;
      assert.equal(route.getSantaTrackerState(now), dwelling ? "LIVE_AT_STOP" : "IN_TRANSIT");
    }
  }
  for (const [iso, id] of [["2026-12-25T10:01:00Z", "hawaii"], ["2026-12-25T11:00:00Z", "american-samoa"], ["2026-12-25T11:19:59Z", "american-samoa"]]) {
    const now = new Date(iso);
    assert.equal(route.getSeasonalTrackerMode(now), "LIVE");
    assert.equal(route.getCurrentStopId(now), id);
    assert.ok(route.getJourneyProgress(now) < 100);
  }
  const end = new Date("2026-12-25T11:20:00Z");
  assert.equal(route.getSeasonalTrackerMode(end), "COMPLETE");
  assert.equal(route.getJourneyProgress(end), 100);
  assert.equal(route.getVisitedStops(end).size, 60);
  assert.equal(route.getDashboardData(end).currentStopName, "American Samoa");
  assert.equal(route.getInterpolatedMapPosition(end).lat, stops.at(-1).lat);
  assert.equal(route.getSeasonalTrackerMode(new Date("2026-12-24T09:59:59Z")), "PREPARING");
  assert.equal(route.getSeasonalTrackerMode(new Date("2026-12-24T10:00:00Z")), "LIVE");
});
test("preview final jumps and accelerated whole journey include the complete final window", () => {
  assert.equal(preview.getJumpTime("hawaii").getUTCHours(), 10);
  assert.equal(preview.getJumpTime("american-samoa").getUTCHours(), 11);
  const end = preview.getJumpTime("complete");
  assert.equal(end.getUTCHours(), 11);
  assert.equal(end.getUTCMinutes(), 20);
  for (const minutes of [2, 5, 10]) assert.equal(preview.getJumpTime("route-start").getTime() + preview.getRunFullJourneySpeed(minutes) * minutes * 60000, end.getTime());
});
test("server-rendered map and both timelines contain all stops and matching coordinates/activities", () => {
  const now = new Date("2026-12-24T18:16:00Z");
  const Map = load("components/SantaMap.tsx").default;
  const Timeline = load("components/SantaTimeline.tsx").default;
  const Story = load("components/SantaStory.tsx").default;
  const map = renderToStaticMarkup(React.createElement(Map, { effectiveTime: now, mapPosition: route.getInterpolatedMapPosition(now) }));
  const timeline = renderToStaticMarkup(React.createElement(Timeline, { effectiveTime: now }));
  assert.equal((map.match(/data-stop-id=/g) || []).length, 60);
  assert.equal((timeline.match(/data-santa-activity=/g) || []).length, 120);
  for (const stop of stops) {
    assert.ok(map.includes(`data-stop-id="${stop.id}"`));
    assert.ok(timeline.includes(`data-santa-activity="${stop.id}"`));
    const marker = map.split(`data-stop-id="${stop.id}"`)[1].split("</g>")[0];
    assert.ok(marker.includes(`cx="${((stop.lng + 180) / 360) * 1000}"`), stop.id);
    assert.ok(marker.includes(`cy="${((90 - stop.lat) / 180) * 500}"`), stop.id);
  }
  for (const iso of ["2026-12-24T18:16:00Z", "2026-12-24T22:01:00Z", "2026-12-25T00:01:00Z", "2026-12-25T11:01:00Z"]) {
    const at = new Date(iso);
    const html = renderToStaticMarkup(React.createElement(Story, { effectiveTime: at }));
    assert.ok(html.includes("data-live-activity"));
    assert.ok(html.includes("data-live-fact"));
    assert.ok(html.includes(route.getDashboardData(at).activityPlace));
  }
});
test("seasonal pools add 24 jokes without changing cadence or adding holiday destinations", () => {
  const source = fs.readFileSync(path.join(root, "components/SantaStory.tsx"), "utf8");
  const pool = name => source.split(`const ${name}`)[1].split("];")[0];
  assert.ok(pool("holidayPostcardEntries").split("\n").length >= 80);
  assert.ok(pool("christmasInJulyPostcards").split("\n").length >= 60);
  assert.ok(pool("workshopDispatches").split("\n").length >= 60);
  assert.equal((source.match(/}, 15000\)/g) || []).length, 2);
  const facts = load("data/christmasFacts.ts").additionalChristmasFacts;
  assert.equal(facts.length, 12);
  assert.equal(new Set(facts).size, 12);
  const holidays = load("data/santaHolidays.ts").holidayDestinations;
  assert.equal(holidays.length, 91);
  assert.ok(route.isHolidaySeason(new Date("2026-11-09T23:59:59Z")));
  assert.ok(route.isRouteResearchSeason(new Date("2026-12-01T00:00:00Z")));
  assert.ok(route.isDecemberPrep(new Date("2026-12-23T00:00:00Z")));
  assert.ok(route.isChristmasInJuly(new Date("2026-07-15T12:00:00Z")));
});
