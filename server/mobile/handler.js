import { ServerResponse } from 'node:http';
import { createMessageAccessHandler, freeSession, availableAt, FREE_ACCESS_COOKIE } from '../santa-message-access.js';
import { createSantaNamesHandler } from '../santa-names.js';
import { createMobileFreeMessageHandler } from './free-message.js';
import { createStudioMessageHandler } from '../santa-studio-message.js';
import { workshopCatalogue } from '../santa-workshop-catalogue.js';
import { privateResponse, consumeNameAccess, readNameJson } from '../santa-name-security.js';
import { getClerkProxyHost } from '../middlewares/clerkProxyMiddleware.js';
import { createMobileStore, mobileProblem } from './store.js';
import { createPurchaseVerifier } from './revenuecat.js';

// Run the existing protected flows in-process, not through a public proxy.
// Capture request-local output so paid usage can commit BEFORE MP3 delivery.
export function captureHandler(handler, req) {
  return new Promise((resolve, reject) => {
    const response = new ServerResponse(req);
    const chunks = [];
    response.writeHead = (status, reasonOrHeaders, headers) => {
      response.statusCode = status;
      for (const [key, value] of Object.entries(headers || (typeof reasonOrHeaders === 'object' ? reasonOrHeaders : {}) || {})) {
        response.setHeader(key, value);
      }
      return response;
    };
    response.write = chunk => { chunks.push(Buffer.from(chunk)); return true; };
    response.end = chunk => {
      if (chunk) chunks.push(Buffer.from(chunk));
      resolve({ status: response.statusCode, headers: response.getHeaders(), bytes: Buffer.concat(chunks) });
      return response;
    };
    try {
      const result = handler(req, response, reject);
      if (result?.catch) result.catch(reject);
    } catch (error) { reject(error); }
  });
}
const decodeJson = result => {
  try { return JSON.parse(result.bytes.toString()); }
  catch { throw new Error('Invalid message response'); }
};
const catalogueProjection = inventory => ({
  categories: Object.fromEntries(Object.entries(inventory.categories).map(([key, values]) =>
    [key, values.map(({ id, label, kind, isCountry }) => ({ id, label, ...(kind ? { kind } : {}), ...(isCountry !== undefined ? { isCountry } : {}) }))])),
  regionalGroups: Object.fromEntries(Object.entries(inventory.regionalGroups || {}).map(([key, group]) =>
    [group.parentId, { parentId: group.parentId, records: group.records.map(({ id, label }) => ({ id, label })) }])),
});

export function createMobileHandler({
  getStore = () => createMobileStore(), verify = createPurchaseVerifier(),
  limit = consumeNameAccess, access = createMessageAccessHandler(),
  names = createSantaNamesHandler(), free = createMobileFreeMessageHandler(),
  studio = createStudioMessageHandler({ authorize: async () => true }),
  catalogue = workshopCatalogue,
} = {}) {
  return async (req, res) => {
    privateResponse(res);
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };
    let lease, store;
    try {
      // Native-only bearer API, not a CORS/cookie escape hatch for web clients.
      if (req.headers.origin || req.headers['sec-fetch-site'] || req.headers.cookie) throw mobileProblem(403, 'Use the iPhone app for this connection.');
      const action = new URL(req.url, 'https://mobile').searchParams.get('action');
      const methods = { session: 'POST', status: 'GET', signup: 'POST', names: 'POST', free: 'POST', catalogue: 'GET', studio: 'POST' };
      if (!methods[action]) return json(404, { error: 'Mobile service not found.' });
      if (req.method !== methods[action]) { res.setHeader('Allow', methods[action]); return json(405, { error: 'Unsupported request method.' }); }
      store = getStore();
      if (action === 'session') {
        await limit(req, 'signup');
        const body = await readNameJson(req);
        if (Object.keys(body).length) throw mobileProblem(400, 'App connections cannot choose their identity.');
        return json(201, await store.createSession());
      }
      const bearer = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization || '');
      const session = await store.session(bearer?.[1]);
      await limit(req, action === 'studio' ? 'studioMessage' : 'studioRead');
      // Only after authentication: trusted in-process adaptation for existing
      // same-site handlers. External headers/cookies cannot choose a grant.
      const protocol = req.headers['x-forwarded-proto']?.split(',')[0].trim() || (req.socket?.encrypted ? 'https' : 'http');
      req.headers.origin = `${protocol}://${getClerkProxyHost(req)}`;
      req.headers['sec-fetch-site'] = 'same-origin';
      req.headers.cookie = session.freeGrant ? `${FREE_ACCESS_COOKIE}=${session.freeGrant}` : '';
      req.url = '/';
      const paid = async () => verify(session.customerId);
      if (action === 'status') {
        const adult = freeSession(req);
        const freeStatus = { authorized: !!adult, availableAt: adult ? await availableAt(adult.subject) : 0 };
        try { return json(200, { freeStatus, entitlement: await store.entitlement(await paid()) }); }
        catch { return json(200, { freeStatus, entitlement: { verified: false, permanent: false, credits: 0 },
          purchaseError: 'Apple purchase access could not be verified. Retry before creating a Studio message.' }); }
      }
      if (['signup', 'names', 'free', 'studio'].includes(action)) req.body = await readNameJson(req);
      if (action === 'signup') {
        const result = await captureHandler(access, req);
        if (result.status === 200) {
          const cookies = [result.headers['set-cookie']].flat().filter(Boolean);
          const grant = cookies.find(c => c.startsWith(`${FREE_ACCESS_COOKIE}=`))?.split(';')[0].slice(FREE_ACCESS_COOKIE.length + 1);
          if (!grant) throw new Error('Signup did not issue access');
          await store.setFreeGrant(session, grant);
        }
        return json(result.status, decodeJson(result));
      }
      if (action === 'names') {
        const studioSearch = req.body.studio === true;
        delete req.body.studio;
        if (studioSearch) {
          const ent = await store.entitlement(await paid());
          if (!ent.permanent && !ent.credits) throw mobileProblem(402, 'Verify a Studio purchase to search its names.');
        } else if (!freeSession(req)) throw mobileProblem(401, 'Please add your adult details before searching.');
        const result = await captureHandler(names, req);
        const data = decodeJson(result);
        return json(result.status, data.records ? { records: data.records.map(({ id, name, variant, selectionToken }) =>
          ({ id, name, ...(variant ? { variant } : {}), token: selectionToken })), warning: data.warning } : data);
      }
      if (action === 'catalogue') {
        const ent = await store.entitlement(await paid());
        if (!ent.permanent && !ent.credits) throw mobileProblem(402, 'A verified Studio purchase is needed.');
        return json(200, catalogueProjection(await catalogue()));
      }
      let result;
      if (action === 'free') result = await captureHandler(free, req);
      if (action === 'studio') {
        lease = await store.reserve(session.customerId, req.headers['x-message-request-id'], await paid());
        result = await captureHandler(studio, req);
        if (result.status === 200 && result.headers['content-type'] === 'audio/mpeg' && result.bytes.length > 0) {
          // Recheck ownership after rendering, including refunds/transfers.
          const current = await paid();
          if (lease.purchaseKey ? !current.single.includes(lease.purchaseKey) : !current.permanent) {
            throw mobileProblem(403, 'The purchase is no longer available. No generation has been used.');
          }
          await store.finish(lease, true);
          lease = null;
        }
      }
      if (!result) throw new Error('Missing mobile response');
      if (result.status === 200 && result.headers['content-type'] === 'audio/mpeg' && result.bytes.length === 0) {
        throw mobileProblem(503, 'The recording was empty. Please retry; no Studio generation was used.');
      }
      if (result.status !== 200 || result.headers['content-type'] !== 'audio/mpeg') return json(result.status, decodeJson(result));
      // No filenames, private selections or origin locations are forwarded.
      res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': result.bytes.length,
        'Content-Disposition': 'attachment; filename="santa-recorded-message.mp3"' });
      res.end(result.bytes);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) {
        if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
        json(error.status || 503, { error: error.status ? error.message : 'The mobile recording service is unavailable. Please retry. No unverified purchase opens Studio.' });
      }
    } finally { if (lease) await store.finish(lease, false).catch(() => {}); }
  };
}
export default createMobileHandler();
