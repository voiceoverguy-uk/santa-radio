// Export-only checks against unchanged source; no service or credentials.
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Date, Intl, Math, Set,
    require(spec) {
      if (!spec.startsWith('@/')) throw new Error(`Unexpected dependency ${spec}`);
      return load(spec.slice(2));
    },
  }, { filename: file });
  return exports;
}
const route = load('lib/santaRoute.ts');
const stops = load('data/santaRouteStops.ts');
test('UTC boundaries, inclusive completion instant and annual reset', () => {
  for (const [iso, mode] of [
    ['2026-12-24T00:00:00Z', 'PREPARING'],
    ['2026-12-24T09:59:59.999Z', 'PREPARING'],
    ['2026-12-24T10:00:00Z', 'LIVE'],
    ['2026-12-25T10:00:00Z', 'LIVE'],
    ['2026-12-25T10:00:00.001Z', 'COMPLETE'],
    ['2026-12-26T00:00:00Z', 'OFF_SEASON'],
    ['2027-01-01T00:00:00Z', 'OFF_SEASON'],
  ]) assert.equal(route.getDashboardData(new Date(iso)).mode, mode, iso);
  assert.equal(route.getDashboardData(new Date('2027-01-01T00:00:00Z')).visitedCount, 0);
  assert.equal(route.getVisitedStops(new Date('2026-12-26T00:00:00Z')).size, 0);
});
test('March–November holiday, July and December workshop are separate UI predicates', () => {
  for (const [iso, holiday] of [
    ['2026-02-28T23:59:59Z', false], ['2026-03-01T00:00:00Z', true],
    ['2026-11-30T23:59:59Z', true], ['2026-12-01T00:00:00Z', false],
  ]) assert.equal(route.isHolidaySeason(new Date(iso)), holiday, iso);
  assert.equal(route.isChristmasInJuly(new Date('2026-07-15T12:00:00Z')), true);
  const date = new Date('2026-12-01T00:00:00Z');
  assert.equal(route.isDecemberPrep(date), true);
  assert.equal(route.getDashboardData(date).mode, 'OFF_SEASON');
  assert.equal(route.getDashboardData(new Date('2026-11-15T12:00:00Z')).holiday, null);
});
test('44 stops, representative timezone midnight and India half-hour arrival', () => {
  assert.equal(stops.santaStops.length, 44);
  for (const stop of stops.santaStops) {
    const arrival = stops.getStopArrivalDate(stop, 2026);
    const offset = stops.getStopUtcOffset(stop, 2026);
    assert.equal(arrival.getTime() + offset * 3600000, Date.UTC(2026, 11, 25), stop.id);
  }
  assert.equal(stops.getStopArrivalDate(stops.santaStops.find(s => s.id === 'india'), 2026).toISOString(), '2026-12-24T18:30:00.000Z');
});
test('UK approach window differs from pinned delivery dwell', () => {
  const before = route.getDashboardData(new Date('2026-12-24T21:59:59Z'));
  assert.notEqual(before.state, 'UK_SPECIAL_WINDOW');
  for (const iso of ['2026-12-24T22:00:00Z', '2026-12-24T23:30:00Z']) {
    const data = route.getDashboardData(new Date(iso));
    assert.equal(data.state, 'UK_SPECIAL_WINDOW');
    assert.equal(data.approachingUK, true);
    assert.match(data.statusHeadline, /Approaching/);
  }
  const uk = stops.santaStops.find(s => s.id === 'uk');
  for (const iso of ['2026-12-25T00:00:00Z', '2026-12-25T00:49:59Z']) {
    const now = new Date(iso), data = route.getDashboardData(now);
    assert.equal(route.getCurrentStopId(now), 'uk');
    assert.equal(data.mapPosition.lat, uk.lat);
    assert.equal(data.mapPosition.lng, uk.lng);
    assert.equal(data.approachingUK, false);
  }
  assert.notEqual(route.getDashboardData(new Date('2026-12-25T00:50:00Z')).state, 'UK_SPECIAL_WINDOW');
});
test('estimated totals at midpoint and completion are not external measurements', () => {
  const mid = route.getDashboardData(new Date('2026-12-24T22:00:00Z'));
  assert.equal(mid.progressPercent, 50);
  assert.equal(mid.estimatedGifts, 1250000000);
  assert.equal(mid.estimatedDistanceKm, 255000000);
  assert.equal(mid.speedLabel, '6,650,000 mph');
  const end = route.getDashboardData(new Date('2026-12-25T10:00:00.001Z'));
  assert.equal(end.progressPercent, 100);
  assert.equal(end.visitedCount, 44);
  assert.equal(end.mapPosition.lng, stops.santaStops.at(-1).lng);
});
test('interpolated positions remain finite and date-line movement takes short arc', () => {
  const arrivals = stops.santaStops.map(stop => ({
    stop, ms: stops.getStopArrivalDate(stop, 2026).getTime(),
  })).sort((a, b) => a.ms - b.ms);
  let crossings = 0;
  for (let i = 0; i < arrivals.length - 1; i++) {
    const a = arrivals[i], b = arrivals[i + 1];
    const dwellEnd = a.ms + a.stop.dwellMinutes * 60000;
    if (b.ms <= dwellEnd || a.stop.id === 'uk') continue;
    const position = route.getInterpolatedMapPosition(new Date((dwellEnd + b.ms) / 2));
    assert.ok(Number.isFinite(position.lat) && Number.isFinite(position.lng));
    if (Math.abs(b.stop.lng - a.stop.lng) > 180) {
      crossings++;
      let delta = b.stop.lng - a.stop.lng;
      delta += delta > 0 ? -360 : 360;
      let expected = a.stop.lng + delta / 2;
      if (expected > 180) expected -= 360;
      if (expected < -180) expected += 360;
      assert.ok(Math.abs(position.lng - expected) < 1e-8);
    }
  }
  assert.ok(crossings > 0, 'exercise an actual date-line segment');
});
