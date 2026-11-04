import { createHmac, timingSafeEqual } from 'node:crypto';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { liveStudioConfig } from './studio-live-config.js';
import { studioSources, studioBells } from './santa-studio-render.js';
import { workshopCatalogue } from './santa-workshop-catalogue.js';
import { santaNameLibrary } from './santa-name-library.js';

// Runs inside the deployed rendering function, not the checkout function.
// The response contains no names, inventory, paths, source URLs or credentials.
export async function studioDeliveryProbe(req, res) {
  if (!req.headers['x-studio-delivery-probe']) return false;
  let config;
  try {
    config = liveStudioConfig();
    const expected = createHmac('sha256', config.secret).update('studio-live-delivery-probe').digest('base64url');
    const supplied = req.headers['x-studio-delivery-probe'];
    if (req.method !== 'GET' || typeof supplied !== 'string' || supplied.length !== expected.length
      || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) throw new Error('Probe denied');
    await access(ffmpeg, constants.X_OK);
    await Promise.all(['intro.flac', '1st.flac', '1-5.flac', '2nd.flac', '3rd.flac', '4th.flac', '5th.flac', '6th.flac']
      .map(file => access(join(studioSources, file), constants.R_OK)));
    await access(studioBells, constants.R_OK);
    const inventory = await workshopCatalogue();
    if (!['age', 'activity', 'achievement', 'treat', 'place'].every(key => inventory.categories[key]?.length)) {
      throw new Error('Catalogue unavailable');
    }
    if (!(await santaNameLibrary.count() > 0)) throw new Error('Names unavailable');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: true, offer: config.offer }));
  } catch {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ready: false }));
  }
  return true;
}
