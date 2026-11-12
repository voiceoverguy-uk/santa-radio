import { useEffect, useState } from 'react';
import { STUDIO_PATH } from '../lib/studioRoute.js';

export default function FriendVouchers({ ownerToken }) {
  const [rows, setRows] = useState(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [copied, setCopied] = useState(null);
  async function load(signal) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/message-statistics?view=friends', {
        headers: { Authorization: `Bearer studio-owner.${ownerToken}` }, cache: 'no-store',
        signal: signal || AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.vouchers)) throw new Error('The voucher list could not load. Please try again.');
      if (!signal?.aborted) setRows(data.vouchers);
    } catch (e) { if (!signal?.aborted) setError(e.message); }
    finally { if (!signal?.aborted) setBusy(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [ownerToken]);
  async function copy(row) {
    try { setCopied(null); setError(''); await navigator.clipboard.writeText(row.code); setCopied(row.slot); }
    catch { setError('Could not copy automatically. Select and copy the code below.'); }
  }
  return <section>
    <h2>Friends &amp; family vouchers</h2>
    <p>20 single-use codes. Each unlocks two premium Santa messages for one recipient. Enter the code in the voucher box at <a href={STUDIO_PATH}>Santa’s Message Maker Studio</a>.</p>
    <p><strong>REDEEMED</strong> means the code has been claimed, not that its messages have been used. Your friend has 30 days from redemption to create their two messages in the same browser. Unused codes remain available. Download recordings and gifts before leaving Studio.</p>
    <button onClick={() => load()} disabled={busy}>{busy ? 'Checking vouchers…' : 'Refresh vouchers'}</button>
    {error && <p role="alert">{error}</p>}
    {copied && <p role="status">Voucher {copied} copied.</p>}
    {rows && <div className="santa-dashboard__table"><table>
      <thead><tr><th scope="col">#</th><th scope="col">Code</th><th scope="col">Status</th><th scope="col">Redeemed · UK time</th><th scope="col">Copy</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.slot}>
        <td>{row.slot}</td><td><code>{row.code}</code></td>
        <td><strong style={{ color: row.redeemedAt ? '#e6b8b8' : '#bce5c1' }}>{row.redeemedAt ? 'REDEEMED' : row.status}</strong></td>
        <td>{row.redeemedAt ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }).format(new Date(row.redeemedAt)) : 'Not redeemed'}</td>
        <td><button disabled={!!row.redeemedAt} onClick={() => copy(row)} aria-label={`Copy voucher ${row.slot}`}>{copied === row.slot ? '✓ Copied!' : 'Copy'}</button></td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}

