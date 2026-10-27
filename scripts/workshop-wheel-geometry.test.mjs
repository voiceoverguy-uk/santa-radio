import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureWorkshopWheel, sameWheelGeometry, nearestWheelIndex } from '../src/lib/workshopWheelGeometry.js';

test('cached geometry supports mixed row heights and edge choices without DOM reads during nearest lookup', () => {
  const top = { style: {} }, bottom = { style: {} };
  const wheel = { clientHeight: 240, clientWidth: 320 };
  const rows = [{ offsetHeight: 48, offsetTop: 96 }, { offsetHeight: 80, offsetTop: 144 }, { offsetHeight: 112, offsetTop: 224 }];
  const geometry = measureWorkshopWheel(wheel, rows, top, bottom);
  assert.equal(top.style.height, '96px');
  assert.equal(bottom.style.height, '64px');
  assert.deepEqual(geometry.centers, [120, 184, 280]);
  assert.equal(nearestWheelIndex(geometry, 0), 0);
  assert.equal(nearestWheelIndex(geometry, 64), 1);
  assert.equal(nearestWheelIndex(geometry, 160), 2);
  assert.equal(nearestWheelIndex(geometry, 100000), 2);
  assert.equal(nearestWheelIndex(geometry, -500), 0);
  assert.equal(nearestWheelIndex(null, 0), -1);
});
test('real geometry changes are distinguished from observer notifications for unchanged rows', () => {
  const a = { height: 240, width: 320, centers: [120, 168, 216] };
  assert.equal(sameWheelGeometry(a, { ...a, centers: [...a.centers] }), true);
  assert.equal(sameWheelGeometry(a, { ...a, height: 300 }), false);
  assert.equal(sameWheelGeometry(a, { ...a, centers: [120, 168, 230] }), false);
  assert.equal(sameWheelGeometry(a, null), false);
});
