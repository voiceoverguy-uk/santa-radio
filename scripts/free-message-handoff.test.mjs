import test from 'node:test';
import assert from 'node:assert/strict';
import { offerFreeSantaMessageName, peekFreeSantaMessageName, clearFreeSantaMessageName } from '../src/lib/freeSantaMessageHandoff.js';

test('free message handoff holds only the deliberate pending selection', () => {
  assert.equal(peekFreeSantaMessageName(), '');
  offerFreeSantaMessageName('Wendy');
  assert.equal(peekFreeSantaMessageName(), 'Wendy');
  // Reads are repeatable for React Strict Mode's initial render.
  assert.equal(peekFreeSantaMessageName(), 'Wendy');
  clearFreeSantaMessageName();
  assert.equal(peekFreeSantaMessageName(), '');
  offerFreeSantaMessageName('Erin');
  offerFreeSantaMessageName(null);
  assert.equal(peekFreeSantaMessageName(), '');
});
