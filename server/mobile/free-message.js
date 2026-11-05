import { fileURLToPath } from 'node:url';
import { createSantaMessageHandler } from '../santa-message.js';
import { mobileFreeRenderArgs } from '../../scripts/santa-audio-mobile-filters.mjs';

export const mobileFreeBells = fileURLToPath(new URL('../santa-audio/mobile-free-sleighbells.mp3', import.meta.url));

export function createMobileFreeMessageHandler(library, cache, options = {}) {
  return createSantaMessageHandler(library, cache, {
    ...options, render: mobileFreeRenderArgs, bells: mobileFreeBells,
  });
}
