import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEntries, createMetadataService } from '../server/radio-metadata.js';
import { parseDuration, parseStationTime } from '../server/radio-feed-timing.js';
import { upcomingSchedule } from '../src/lib/radio-schedule.js';

test('new fields are separate, legacy titles and internal separators survive', () => {
  assert.deepEqual(parseEntries("Band Aid - Do They Know It's Christmas - 3:37 - 2026-11-26 20:35:57 \n"),
    [{ artist: 'Band Aid', title: "Do They Know It's Christmas", durationSeconds: 217, startedAt: Date.parse('2026-11-26T20:35:57Z') }]);
  assert.equal(parseEntries('Artist - Song - Live - 2:30 - 2026-11-26 17:50:27')[0].title, 'Song - Live');
  assert.deepEqual(parseEntries('Artist - Song - Live'), [{ artist: 'Artist', title: 'Song - Live' }]);
  assert.deepEqual(parseEntries('Artist - Song - 3:99 - 2026-02-30 17:50:27'), [{ artist: 'Artist', title: 'Song' }]);
});

test('station time uses UK timezone independently of the server timezone', () => {
  assert.equal(parseStationTime('2026-11-26 20:35:57'), Date.parse('2026-11-26T20:35:57Z'));
  assert.equal(parseStationTime('2026-07-26 20:35:57'), Date.parse('2026-07-26T19:35:57Z'));
  for (const value of ['2026-03-29 01:30:00', '2026-10-25 01:30:00', '2026-11-26 24:00:00', '2026-02-30 12:00:00']) {
    assert.equal(parseStationTime(value), null);
  }
  assert.equal(parseDuration('1:02:03'), 3723);
  assert.equal(parseDuration('217'), 217);
  for (const value of ['0:00', '3:60', '-5', 'Infinity', '90000']) assert.equal(parseDuration(value), null);
});

test('service cleans titles, reconciles the queue, and estimates immediately from feed timing', async () => {
  const service = createMetadataService(async url => new Response(url.pathname.endsWith('Nowplaying.txt')
    ? "Band Aid - Do They Know It's Christmas - 3:37 - 2026-11-26 20:35:57"
    : "Band Aid - Do They Know It's Christmas\nNew Artist - Unknown song\nColdplay - Christmas Lights", { headers: { 'content-type': 'text/plain' } }));
  const metadata = await service();
  assert.equal(metadata.current.title, "Do They Know It's Christmas");
  assert.equal(metadata.upcoming.length, 2);
  const now = Date.parse('2026-11-26T20:37:00Z');
  const schedule = upcomingSchedule({ ...metadata, currentStartedAt: now }, now);
  assert.equal(schedule[0].estimatedAt, Date.parse('2026-11-26T20:39:39Z'));
  assert.equal(schedule[1].estimatedAt, Date.parse('2026-11-26T20:43:14Z'));
  assert.equal(upcomingSchedule(metadata, Date.parse('2026-11-26T20:40:00Z'))[0].estimatedAt, null);
  assert.equal(upcomingSchedule(metadata, Date.parse('2026-11-26T20:30:00Z'))[0].estimatedAt, null);
});
