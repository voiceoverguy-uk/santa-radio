import { useState } from 'react';
import { STUDIO_PATH } from '../lib/studioRoute.js';

const labels = {
  database: 'Production schema and database permissions',
  stripe: 'Live Stripe account and £6.50 price',
  webhookEndpoint: 'Live webhook endpoint and events',
  renderer: 'Protected renderer prerequisites',
  webhookDelivery: 'Genuine signed live webhook delivery',
  sender: 'Recent production sender verification',
  worker: 'Recent retry-worker verification',
  retryApproved: 'Scheduled email retry approved',
};
export default function StudioOwnerReadiness() {
  const [report, setReport] = useState(null), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const run = async action => {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/santa-workshop-usage?diagnostic=live-launch', {
        credentials: 'same-origin', cache: 'no-store',
        ...(action ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) } : {}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Production check failed.');
      if (action === 'canary') {
        if (data.pending) { window.location.assign(`${STUDIO_PATH}?checkout=return`); return; }
        const url = new URL(data.url);
        if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com' || url.username || url.password) throw new Error('Unexpected checkout URL.');
        window.location.assign(url.href); return;
      }
      if (!action) {
        if (!data.checks || Object.keys(labels).some(k => typeof data.checks[k] !== 'boolean')) throw new Error('Invalid readiness response.');
        setReport(data);
      } else {
        setReport(null);
        setMessage('Simulator accepted and retry-worker execution verified. Run checks again. This does not approve scheduled retries or enable public sales.');
      }
    } catch (e) { setMessage(e.message); }
    finally { setBusy(false); }
  };
  return <section className="studio-storage-diagnostic" aria-labelledby="studio-owner-readiness-title">
    <h2 id="studio-owner-readiness-title">Private Studio launch checks</h2>
    <p>Runs inside Vercel using existing credentials. Nothing here enables public sales. Renderer checks verify prerequisites, not a completed recording.</p>
    <button type="button" disabled={busy} onClick={() => run()}>Check production readiness</button>{' '}
    <button type="button" disabled={busy} onClick={() => run('simulator')}>Test simulator email and retry worker</button>
    <p>The simulator refuses a non-empty outbox and never sends customer emails. Approve scheduled retries in Vercel only after this passes.</p>
    {report && <ul>{Object.entries(labels).map(([key, label]) => <li key={key}>{label}: {report.checks[key] ? 'Passed' : 'Not verified / not ready'}
      {!report.checks[key] && report.failures?.[key] && <> ({Object.entries(report.failures[key]).map(([k, v]) => `${k}: ${v}`).join(', ')})</>}</li>)}</ul>}
    {report?.stripeCredential && !report.stripeCredential.accepted && <p>Stripe key format check: {Object.entries(report.stripeCredential).filter(([k, v]) => k !== 'accepted' && (k === 'present' ? !v : v)).map(([k]) => k === 'present' ? 'missing' : k).join(', ') || 'unsupported format'}</p>}
    <button type="button" disabled={busy || !report?.canaryReady} onClick={() => {
      if (window.confirm('Open a real £6.50 checkout for the owner? No payment is made until you complete Stripe checkout. Public sales stay off.')) run('canary');
    }}>Open owner-only £6.50 checkout</button>
    <p>The canary can precede the first webhook delivery, but every other check must pass. It grants no access until Stripe confirms your payment. Returning preserves exactly two creations.</p>
    <p role="status" aria-live="polite">{busy ? 'Checking…' : message}</p>
  </section>;
}
