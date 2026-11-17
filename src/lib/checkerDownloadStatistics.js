// Measurement failure must never prevent a certificate download.
export function trackCheckerDownload() {
  try {
    const eventId = crypto.randomUUID();
    void fetch('/api/message-statistics', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      keepalive: true, credentials: 'omit',
      body: JSON.stringify({ action: 'checker-pdf-download', eventId }),
    }).catch(() => {});
  } catch { /* Unsupported/offline browsers can still save their PDF. */ }
}
