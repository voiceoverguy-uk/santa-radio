const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src/tracker');
const cache = new Map();
function load(relative) {
  let file = path.resolve(root, relative);
  if (!path.extname(file)) file += '.ts';
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Date, Intl, Math, Set,
    require(spec) {
      if (spec.startsWith('./')) return load(path.relative(root, path.resolve(path.dirname(file), spec)));
      if (!spec.startsWith('@/')) throw Error(`Unexpected dependency: ${spec}`);
      return load(spec.slice(2));
    },
  }, { filename: file });
  return exports;
}
const route = load('lib/santaRoute.ts');
const stops = load('data/santaRouteStops.ts');
const preview = load('lib/santaPreview.ts');
test('current departure, exact completion boundary and annual reset', () => {
  for (const [iso, mode] of [
    ['2026-12-24T00:00:00Z', 'PREPARING'],
    ['2026-12-24T09:59:59.999Z', 'PREPARING'],
    ['2026-12-24T10:00:00Z', 'LIVE'],
    ['2026-12-25T10:00:00.001Z', 'LIVE'],
    ['2026-12-25T11:19:59.999Z', 'LIVE'],
    ['2026-12-25T11:20:00Z', 'COMPLETE'],
    ['2026-12-26T00:00:00Z', 'OFF_SEASON'],
    ['2027-01-01T00:00:00Z', 'OFF_SEASON'],
  ]) assert.equal(route.getDashboardData(new Date(iso)).mode, mode, iso);
  const end = route.getDashboardData(new Date('2026-12-25T11:20:00Z'));
  assert.equal(end.visitedCount, 60);
  assert.equal(end.progressPercent, 100);
  assert.match(end.currentStopName, /American Samoa/);
  assert.equal(route.getDashboardData(new Date('2027-01-01T00:00:00Z')).visitedCount, 0);
  assert.equal(route.getVisitedStops(new Date('2026-12-26T00:00:00Z')).size, 0);
});
test('holiday, July and December dispatch boundaries', () => {
  for (const [iso, expected] of [
    ['2026-02-28T23:59:59.999Z', false], ['2026-03-01T00:00:00Z', true],
    ['2026-11-30T23:59:59.999Z', true], ['2026-12-01T00:00:00Z', false],
  ]) assert.equal(route.isHolidaySeason(new Date(iso)), expected);
  assert.equal(route.isChristmasInJuly(new Date('2026-07-15T12:00:00Z')), true);
  assert.equal(route.isDecemberPrep(new Date('2026-12-01T00:00:00Z')), true);
  assert.equal(route.getDashboardData(new Date('2026-12-01T00:00:00Z')).mode, 'OFF_SEASON');
});
test('60 unique stops, 37 Christmas offsets, representative local midnight', () => {
  assert.equal(stops.santaStops.length, 60);
  assert.equal(new Set(stops.santaStops.map(s => s.id)).size, 60);
  assert.equal(new Set(stops.santaStops.map(s => stops.getStopUtcOffset(s, 2026))).size, 37);
  for (const year of [2026, 2027]) for (const stop of stops.santaStops) {
    const arrival = stops.getStopArrivalDate(stop, year);
    assert.equal(arrival.getTime() + stops.getStopUtcOffset(stop, year) * 3600000, Date.UTC(year, 11, 25), stop.id);
  }
  for (const [id, iso] of [['india', '2026-12-24T18:30:00.000Z'], ['chatham-islands', '2026-12-24T10:15:00.000Z'], ['kathmandu', '2026-12-24T18:15:00.000Z']]) {
    assert.equal(stops.getStopArrivalDate(stops.santaStops.find(s => s.id === id), 2026).toISOString(), iso);
  }
});
test('UK approach is not delivery; UK dwell pins marker and clock', () => {
  for (const iso of ['2026-12-24T22:00:00Z', '2026-12-24T23:30:00Z']) {
    const data = route.getDashboardData(new Date(iso));
    assert.equal(data.approachingUK, true);
    assert.match(data.statusHeadline, /Approaching/);
  }
  const uk = stops.santaStops.find(s => s.id === 'uk');
  for (const iso of ['2026-12-25T00:00:00Z', '2026-12-25T00:49:59Z']) {
    const data = route.getDashboardData(new Date(iso));
    assert.equal(route.getCurrentStopId(new Date(iso)), 'uk');
    assert.equal(data.mapPosition.lat, uk.lat);
    assert.equal(data.mapPosition.lng, uk.lng);
    assert.equal(data.approachingUK, false);
  }
  assert.notEqual(route.getSantaTrackerState(new Date('2026-12-25T00:50:00Z')), 'UK_SPECIAL_WINDOW');
});
test('every minute of journey produces finite map coordinates and monotonic estimates', () => {
  const start = Date.parse('2026-12-24T10:00:00Z'), end = Date.parse('2026-12-25T11:20:00Z');
  let previous = -1;
  for (let time = start; time <= end; time += 60000) {
    const d = route.getDashboardData(new Date(time));
    assert.ok(d.progressPercent >= previous && d.progressPercent <= 100);
    previous = d.progressPercent;
    assert.ok(d.mapPosition.lng >= -180 && d.mapPosition.lng <= 180);
    assert.ok(Number.isFinite(d.mapPosition.x) && Number.isFinite(d.mapPosition.y));
  }
});
test('preview jumps and full-run speed cover the current route, not the old route', () => {
  assert.equal(preview.getJumpTime('complete').toISOString().slice(5), '12-25T11:20:00.000Z');
  assert.equal(preview.getJumpTime('route-start').toISOString().slice(5), '12-24T09:55:00.000Z');
  for (const minutes of [2, 5, 10]) {
    assert.ok(Math.abs(preview.getRunFullJourneySpeed(minutes) * minutes * 60000 - (25 * 60 + 25) * 60000) < 1);
  }
});
