// Deduplicate in the browser after acknowledgement; the server also deduplicates atomically.
const sent = new Set(), pending = new Set();
export async function trackMessageAction(receipt, action) {
  if (!receipt) return;
  const key = `${receipt}:${action}`;
  if (sent.has(key) || pending.has(key)) return;
  pending.add(key);
  try {
    const response = await fetch('/api/message-statistics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ receipt, action }),
    });
    if (response.ok) sent.add(key);
  } catch { /* Measurement must never interrupt playback, saving or sharing. */ }
  finally { pending.delete(key); }
}
