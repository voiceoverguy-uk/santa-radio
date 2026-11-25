import { formatUkDateTime } from '../lib/ukDates.js';
import { useEffect, useState } from 'react';
import { STUDIO_PATH } from '../lib/studioRoute.js';
import './FriendVouchers.css';

const PAGE_SIZE = 5;

async function voucherImage(code, isDad) {
  const logo = new Image();
  logo.src = isDad ? '/images/dad-message-logo-v4.webp' : '/images/kids-message-logo-v1.webp';
  await logo.decode();

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1200;
  const ctx = canvas.getContext('2d');
  const gold = '#efcf79', cream = '#fff6e5', dark = '#0d2d23';
  const background = ctx.createLinearGradient(0, 0, 0, 1200);
  background.addColorStop(0, isDad ? '#611b29' : '#19533c');
  background.addColorStop(1, dark);
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1200, 1200);
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, 1128, 1128);
  ctx.textAlign = 'center';

  function line(text, y, font, colour = cream) {
    ctx.font = font;
    ctx.fillStyle = colour;
    ctx.fillText(text, 600, y, 1040);
  }

  line('SANTA RADIO', 112, 'bold 32px sans-serif', gold);
  ctx.drawImage(logo, 275, 130, 650, 362);
  line('Christmas Gift Voucher', 557, 'bold 65px Georgia');
  line(isDad ? 'One personalised video for Dad' : 'Two personalised videos for one child', 624, 'bold 35px sans-serif', gold);
  line(isDad ? 'Includes Dad’s OFFISHAL Nice-ish List certificate' : 'Includes a Nice List certificate, Santa letter and festive picture', 674, '27px sans-serif');
  ctx.fillStyle = dark;
  ctx.fillRect(130, 720, 940, 148);
  ctx.strokeRect(130, 720, 940, 148);
  line('YOUR VOUCHER CODE', 774, 'bold 24px sans-serif', gold);
  line(code, 834, 'bold 40px monospace');
  line(`SantaRadio.co.uk${isDad ? '/dad-message-maker' : STUDIO_PATH}`, 945, 'bold 30px sans-serif');
  line('Open “Friend or Guest?” and enter your code.', 1011, '30px sans-serif');
  line('Create your message in the same browser after claiming.', 1073, '27px sans-serif', gold);

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image export failed')), 'image/png');
  });
}
const tabs = [
  { label: 'Dads', view: 'dad-vouchers' },
  { label: 'Kids', view: 'friends' },
];
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
  const [notice, setNotice] = useState('');
  const [copying, setCopying] = useState('');
  const [unsaved, setUnsaved] = useState(new Set());

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
    function refreshWhenVisible() { if (!document.hidden) load(); }
    const timer = setInterval(refreshWhenVisible, 30000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      controller.abort();
    };
  }, [view, ownerToken, refresh]);

  async function copy(row, asImage = false) {
    const { code } = row;
    const needsSave = !asImage && unsaved.has(code);
    let image;
    setCopying(code);
    setCopyError('');
    setNotice('');
    try {
      if (asImage) {
        try {
          image = await voucherImage(code, isDad);
        } catch {
          setCopyError('The voucher image could not be made. Try again or copy the code.');
          return;
        }
      }
      if (!asImage && !needsSave) {
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          setCopyError('Clipboard access failed. Allow copying in your browser and try again.');
          return;
        }
      }
      const response = await fetch(`/api/message-statistics?view=${view}`, {
        method: 'PATCH', keepalive: true,
        headers: { Authorization: `Bearer studio-owner.${ownerToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'copy', code }),
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 409) {
        setCopyError('This voucher has already been used. Choose another code before sending.');
      } else {
        if (!response.ok) throw new Error();
        const { copiedAt, alreadyCopied } = await response.json();
        if (!copiedAt) throw new Error();
        setRows(current => current?.map(item => item.code === code ? { ...item, copiedAt } : item));
        if (alreadyCopied && !row.copiedAt && !needsSave) {
          setCopyError('This code was already marked as copied. Check who it was sent to before sharing it again.');
        } else if (image) {
          const url = URL.createObjectURL(image);
          const link = document.createElement('a');
          link.href = url;
          link.download = `Santa-Radio-${isDad ? 'Dad' : 'Kids'}-Voucher.png`;
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 30_000);
          setNotice('Voucher image downloaded.');
        } else {
          setNotice(needsSave ? 'Copied tick saved.' : 'Voucher copied.');
        }
      }
      setUnsaved(current => { const next = new Set(current); next.delete(code); return next; });
      setRefresh(n => n + 1);
    } catch {
      if (asImage) {
        setCopyError('The voucher image could not be downloaded. Please try again.');
        return;
      }
      setUnsaved(current => new Set(current).add(code));
      setCopyError('The code is on your clipboard, but its tick could not be saved. Select Save tick before sending it.');
    } finally {
      setCopying('');
    }
  }

  return (
    <>
      {isDad ? (
        <p>Each code unlocks one message at <a href="/dad-message-maker">Dad’s Message Maker</a>. The dashboard keeps a pool of 15 codes.</p>
      ) : (
        <p>Each of the 20 single-use codes unlocks two premium messages for one child at <a href={STUDIO_PATH}>Santa’s Message Maker Studio</a>. Download the recordings and gifts before leaving the Studio.</p>
      )}
      <p>A green tick means the code has been copied or its image downloaded. When the recipient claims it, it shows as <strong>Used</strong> for 24 hours. A fresh code then takes its place.</p>
      <p>Recipients have 30 days from claiming a code to create their {isDad ? 'message' : 'messages'} in the same browser.</p>
      <button type="button" disabled={busy} onClick={() => setRefresh(n => n + 1)}>
        {busy ? 'Checking vouchers…' : 'Refresh vouchers'}
      </button>
      {loadError && <p role="alert">{loadError}</p>}
      {copyError && <p role="alert">{copyError}</p>}
      {notice && <p role="status">{notice}</p>}
      {rows?.length === 0 && <p>No vouchers to show.</p>}
      {rows?.length > 0 && (
        <>
          <div className="santa-dashboard__table">
            <table>
              <thead><tr>
                {!isDad && <th scope="col">#</th>}
                <th scope="col">Code</th><th scope="col">Status</th>
                <th scope="col">Claimed · UK time</th><th scope="col">Copy</th><th scope="col">Image</th>
              </tr></thead>
              <tbody>
                {rows.slice(0, visible).map(row => (
                  <tr key={row.code}>
                    {!isDad && <td>{row.slot}</td>}
                    <td><code>{row.code}</code></td>
                    <td>{row.redeemedAt ? <strong className="voucher-claimed">Used</strong>
                      : row.copiedAt ? <strong className="voucher-copied"><span aria-hidden="true">✓ </span>Copied</strong>
                      : unsaved.has(row.code) ? <strong>Tick unsaved</strong>
                      : <strong className="voucher-available">Available</strong>}</td>
                    <td>{row.redeemedAt ? formatUkDateTime(row.redeemedAt) : 'Unclaimed'}</td>
                    <td>{!row.redeemedAt && (
                      <button type="button" onClick={() => copy(row)} disabled={Boolean(copying)}
                        aria-label={`${unsaved.has(row.code) ? 'Save tick for' : row.copiedAt ? 'Copy again' : 'Copy'} ${row.code}`}>
                        {copying === row.code ? 'Saving…' : unsaved.has(row.code) ? 'Save tick' : row.copiedAt ? 'Copy again' : 'Copy'}
                      </button>
                    )}</td>
                    <td>{!row.redeemedAt && <button type="button" disabled={Boolean(copying)} onClick={() => copy(row, true)}
                      aria-label={`Download voucher image for ${row.code}`}>Download image</button>}</td>
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
