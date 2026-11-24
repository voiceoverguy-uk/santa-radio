import { useEffect, useState } from 'react';
import { STUDIO_PATH } from '../lib/studioRoute.js';
import './FriendVouchers.css';

const PAGE_SIZE = 5;
const tabs = [
  { label: 'Dads', view: 'dad-vouchers' },
  { label: 'Kids', view: 'friends' },
];
const ukTime = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London',
});

export default function FriendVouchers({ ownerToken }) {
  const [selected, setSelected] = useState(0);

  function navigateTabs(event, index) {
    const next = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    event.currentTarget.parentElement.children[next].focus();
    setSelected(next);
  }

  return (
    <section className="dashboard-themed dashboard-themed--gifts" aria-labelledby="voucher-heading">
      <header className="dashboard-themed__header">
        <div className="dashboard-themed__gifts" aria-hidden="true">🎁 ✨ 🎁</div>
        <h2 id="voucher-heading">Friends &amp; family vouchers</h2>
      </header>
      <div role="tablist" className="voucher-tabs" aria-label="Voucher type">
        {tabs.map(({ label, view }, index) => (
          <button key={view} type="button" role="tab" id={`tab-${view}`}
            aria-controls={`panel-${view}`} aria-selected={selected === index}
            tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)}
            onKeyDown={event => navigateTabs(event, index)}>
            {label}
          </button>
        ))}
      </div>
      {tabs.map(({ view }, index) => (
        <div key={view} role="tabpanel" id={`panel-${view}`} aria-labelledby={`tab-${view}`} hidden={selected !== index}>
          {selected === index && <VoucherList key={ownerToken} view={view} ownerToken={ownerToken} />}
        </div>
      ))}
    </section>
  );
}

function VoucherList({ view, ownerToken }) {
  const isDad = view === 'dad-vouchers';
  const [rows, setRows] = useState(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [copyError, setCopyError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function load() {
      if (pending) return;
      pending = true;
      setBusy(true);
      setLoadError('');
      try {
        const response = await fetch(`/api/message-statistics?view=${view}`, {
          headers: { Authorization: `Bearer studio-owner.${ownerToken}` },
          cache: 'no-store',
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!Array.isArray(data.vouchers)) throw new Error();
        if (!controller.signal.aborted) setRows(data.vouchers);
      } catch {
        if (!controller.signal.aborted) setLoadError('Vouchers could not load. Please refresh to try again.');
      } finally {
        pending = false;
        if (!controller.signal.aborted) setBusy(false);
      }
    }
    load();
    const timer = isDad && setInterval(() => { if (!document.hidden) load(); }, 30000);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [view, isDad, ownerToken, refresh]);

  async function copy(code) {
    setCopied('');
    setCopyError('');
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
    } catch {
      setCopyError('Please select the voucher code and copy it manually.');
    }
  }

  return (
    <>
      {isDad ? (
        <p>Each code unlocks one message at <a href="/dad-message-maker">Dad’s Message Maker</a>. Claiming a code adds a replacement to the pool of 15 active codes. Used codes appear here for five days.</p>
      ) : (
        <p>Each of the 20 single-use codes unlocks two premium messages for one child at <a href={STUDIO_PATH}>Santa’s Message Maker Studio</a>. Download the recordings and gifts before leaving the Studio.</p>
      )}
      <p>Recipients have 30 days from claiming a code to create their {isDad ? 'message' : 'messages'} in the same browser.</p>
      <button type="button" disabled={busy} onClick={() => setRefresh(n => n + 1)}>
        {busy ? 'Checking vouchers…' : 'Refresh vouchers'}
      </button>
      {loadError && <p role="alert">{loadError}</p>}
      {copyError && <p role="alert">{copyError}</p>}
      {copied && <p role="status">Voucher copied.</p>}
      {rows?.length === 0 && <p>No vouchers to show.</p>}
      {rows?.length > 0 && (
        <>
          <div className="santa-dashboard__table">
            <table>
              <thead><tr>
                {!isDad && <th scope="col">#</th>}
                <th scope="col">Code</th><th scope="col">Status</th>
                <th scope="col">Claimed · UK time</th><th scope="col">Copy</th>
              </tr></thead>
              <tbody>
                {rows.slice(0, visible).map(row => (
                  <tr key={row.code}>
                    {!isDad && <td>{row.slot}</td>}
                    <td><code>{row.code}</code></td>
                    <td><strong className={row.redeemedAt ? 'voucher-claimed' : 'voucher-available'}>
                      {row.redeemedAt && !isDad ? 'REDEEMED' : row.status}
                    </strong></td>
                    <td>{row.redeemedAt ? ukTime.format(new Date(row.redeemedAt)) : 'Unclaimed'}</td>
                    <td>{!row.redeemedAt && (
                      <button type="button" onClick={() => copy(row.code)} aria-label={`Copy ${row.code}`}>
                        {copied === row.code ? 'Copied!' : 'Copy'}
                      </button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="santa-dashboard__pagination">
            <span aria-live="polite">Showing {Math.min(visible, rows.length)} of {rows.length} vouchers</span>
            {visible < rows.length && (
              <button type="button" onClick={() => setVisible(n => n + PAGE_SIZE)}>Load more</button>
            )}
            {visible > PAGE_SIZE && (
              <button type="button" onClick={() => setVisible(PAGE_SIZE)}>Show fewer</button>
            )}
          </div>
        </>
      )}
    </>
  );
}
