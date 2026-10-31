import { privateResponse } from './santa-name-security.js';

// Completed-cache URLs must remain server-side. The message handler can still
// use its internal cache; the public descriptor shortcut is intentionally gone.
export function createSantaGreetingHandler() {
  return async (req, res) => {
    privateResponse(res);
    res.writeHead(410, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ available: false }));
  };
}
export default createSantaGreetingHandler();
