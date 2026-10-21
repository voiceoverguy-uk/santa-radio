import { yesterdayWindow } from './radio-history-time.js';
import { readChart } from './radio-history-store.js';
export function createTopTenHandler({ enabled = () => process.env.RADIO_HISTORY_ENABLED === 'true',
  read = readChart, clock = () => new Date() } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); return res.end(); }
    const now = clock();
    const window = yesterdayWindow(now);
    if (!enabled()) return res.end(JSON.stringify({ ...window, state: 'inactive', songs: [], coverage: null }));
    try { res.end(JSON.stringify(await read(window, undefined, now))); }
    catch {
      console.warn('[radio-history] Chart storage unavailable');
      res.statusCode = 503;
      res.end(JSON.stringify({ ...window, error: 'Radio history is unavailable. Please try again.' }));
    }
  };
}
export default createTopTenHandler();
