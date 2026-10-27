import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createWorkshopSounds, WORKSHOP_SOUNDS } from '../src/lib/workshopSounds.js';

function fixture(options = {}) {
  const players = [], statuses = [];
  const engine = createWorkshopSounds({
    onStatus: message => statuses.push(message),
    createAudio: source => {
      const player = { src: source, currentTime: 0, loads: 0, pauses: 0, plays: 0,
        load() { this.loads++; },
        pause() { this.pauses++; },
        play() { this.plays++; return options.play?.() || Promise.resolve(); },
        removeAttribute(key) { delete this[key]; },
      };
      players.push(player);
      return player;
    },
  });
  return { engine, players, statuses };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('supplied sound files are byte-for-byte preserved', async () => {
  for (const [file, hash] of [
    ['click-scroller.mp3', '9e7c1665ebd27f1906b9a274559816abe392b292b7aa60f8074b9236560332f2'],
    ['message-next.mp3', '2d5e1fa474bc39e9c664c353faf3ada6e71bbd9ea22bbc973fc16876c2d8e394'],
  ]) {
    assert.equal(createHash('sha256').update(await readFile(`public/audio/workshop/${file}`)).digest('hex'), hash);
  }
});
test('construction and preparation are silent, only explicit next/tick calls play the right files', async () => {
  const { engine, players } = fixture();
  assert.equal(players.length, 0);
  engine.prepare();
  assert.equal(players.length, 2);
  assert.equal(players.reduce((total, item) => total + item.plays, 0), 0);
  engine.playNext();
  assert.equal(players.find(item => item.src === WORKSHOP_SOUNDS.next).plays, 1);
  engine.playTick();
  assert.equal(players.find(item => item.src === WORKSHOP_SOUNDS.tick).plays, 1);
  assert.ok(players.every(item => item.pauses === 2));
  engine.dispose();
  await flush();
});
test('mute stops feedback, prevents new playback, and unmute does not itself play', () => {
  const { engine, players } = fixture();
  engine.playNext();
  engine.setEnabled(false);
  engine.playNext(); engine.playTick(); engine.prepare();
  assert.equal(players.reduce((sum, item) => sum + item.plays, 0), 1);
  engine.setEnabled(true);
  assert.equal(players.reduce((sum, item) => sum + item.plays, 0), 1);
  engine.playNext();
  assert.equal(players.reduce((sum, item) => sum + item.plays, 0), 2);
  engine.dispose();
});
test('blocked or failed playback reports a friendly status without interrupting flow', async () => {
  const { engine, statuses } = fixture({ play: () => Promise.reject(Object.assign(Error('blocked'), { name: 'NotAllowedError' })) });
  assert.doesNotThrow(() => engine.playNext());
  await flush();
  assert.match(statuses.at(-1), /browser blocked workshop sounds/);
  engine.dispose();
  const unsupported = createWorkshopSounds({ createAudio: () => { throw Error('Audio unsupported'); }, onStatus: text => statuses.push(text) });
  assert.doesNotThrow(() => unsupported.playNext());
  assert.match(statuses.at(-1), /unavailable/);
  unsupported.dispose();
});
test('mute and unmount cancel players and ignore delayed playback rejection', async () => {
  let reject;
  const { engine, players, statuses } = fixture({ play: () => new Promise((_, failure) => { reject = failure; }) });
  engine.playNext();
  engine.setEnabled(false);
  reject(Error('cancelled by mute'));
  await flush();
  assert.deepEqual(statuses, []);
  engine.setEnabled(true);
  engine.playNext();
  engine.dispose();
  reject(Error('cancelled by leaving'));
  await flush();
  assert.deepEqual(statuses, []);
  assert.ok(players.every(item => !item.src && item.onerror === null));
  engine.playNext();
  assert.equal(players.reduce((sum, item) => sum + item.plays, 0), 2);
});
