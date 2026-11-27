import { useEffect, useState } from 'react';

const creditLabels = { available: 'Available', used: 'Used', expired: 'Expired', preparing: 'Preparing' };

function ukTime(value) {
  return new Date(value).toLocaleString('en-GB', { timeZone: 'Europe/London' });
}

export default function DadRecordingSupport({ ownerToken }) {
  const [reference, setReference] = useState('');
  const [cases, setCases] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function load(search = '', replacement = '') {
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ view: 'dad-support' });
    if (search) query.set('reference', search);
    try {
      const response = await fetch(`/api/message-statistics?${query}`, {
        method: replacement ? 'PATCH' : 'GET',
        headers: { Authorization: `Bearer studio-owner.${ownerToken}`, 'Content-Type': 'application/json' },
        ...(replacement ? { body: JSON.stringify({ action: 'record-replacement', reference: replacement }) } : {}),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not check recording support.');
      setCases(current => replacement
        ? current.map(item => data.cases.find(updated => updated.reference === item.reference) || item)
        : data.cases);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open, ownerToken]);

  return <details id="dad-recording-support" className="dashboard-themed" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Dad’s recording support</summary>
    {open && <>
      <form onSubmit={event => { event.preventDefault(); load(reference.trim()); }}>
        <label htmlFor="dad-support-reference">Support reference</label>
        <input id="dad-support-reference" value={reference} onChange={event => setReference(event.target.value)} maxLength={36} />
        <button disabled={loading}>Search or refresh</button>
      </form>
      {loading && <p role="status">Checking support cases…</p>}
      {error && <p role="alert">{error}</p>}
      {cases?.length === 0 && <p>No support cases found.</p>}
      {cases?.map(item => <section key={item.reference}>
        <h3><code>{item.reference}</code></h3>
        <p>{item.failedAttempts} unsuccessful attempts. Credit {creditLabels[item.creditStatus]?.toLowerCase()}.</p>
        {item.recordingCompletedAt && <p>Recording completed at {ukTime(item.recordingCompletedAt)}.</p>}
        <ul>{item.recentFailures.map((failure, index) =>
          <li key={index}>{ukTime(failure.at)} · {failure.stage} · HTTP {failure.status}{failure.code ? ` · ${failure.code}` : ''}{failure.aborted ? ' · Interrupted' : ''}</li>)}</ul>
        {item.replacementRecordedAt ? <p>Replacement recorded at {ukTime(item.replacementRecordedAt)}.</p>
          : ['used', 'expired'].includes(item.creditStatus) && <button type="button" disabled={loading}
            onClick={() => load('', item.reference)}>Record replacement voucher issued</button>}
      </section>)}
    </>}
  </details>;
}
