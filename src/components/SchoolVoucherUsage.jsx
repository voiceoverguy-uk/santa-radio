import { useCallback, useEffect, useRef, useState } from 'react';
import './SchoolVoucherUsage.css';
import StudioStorageDiagnostic from './StudioStorageDiagnostic.jsx';
import StudioOwnerReadiness from './StudioOwnerReadiness.jsx';

const numberFormat = new Intl.NumberFormat('en-GB');

function formatUKDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
    timeZoneName: 'short',
  }).format(date);
}

function getErrorMessage(status) {
  if (status === 401) return 'Please sign in to your staff account to view school-voucher usage.';
  if (status === 403) return 'Your staff account is not approved to view these private usage totals. Please contact an administrator.';
  if (status === 503) return 'School-voucher usage is temporarily unavailable. Please try refreshing in a little while.';
  return 'We could not load school-voucher usage. Check your connection and try again.';
}

function isUsageResponse(value) {
  return value && typeof value === 'object'
    && Array.isArray(value.vouchers)
    && value.vouchers.every(voucher => voucher && Number.isInteger(voucher.slot)
      && typeof voucher.name === 'string' && typeof voucher.code === 'string'
      && ['entries', 'messages', 'corrections', 'totalRecordings', 'startedAnother']
        .every(key => Number.isInteger(voucher[key]) && voucher[key] >= 0)
      && (voucher.firstEntryAt === null || typeof voucher.firstEntryAt === 'string'))
    && ['entries', 'messages', 'corrections', 'totalRecordings', 'startedAnother']
      .every(key => Number.isInteger(value[key]) && value[key] >= 0)
    && (value.firstEntryAt === null || typeof value.firstEntryAt === 'string');
}

const metrics = [
  { key: 'entries', label: 'Voucher entries', note: 'Successfully tracked voucher logins' },
  { key: 'messages', label: 'First recordings', note: 'Messages from first successful recordings' },
  { key: 'corrections', label: 'Corrections', note: 'Recorded separately from first messages' },
  { key: 'totalRecordings', label: 'Total recordings', note: 'Successful recordings linked to tracked entries' },
  { key: 'startedAnother', label: 'Another test started', note: 'A deliberate repeat test creates another message' },
];

export default function SchoolVoucherUsage() {
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(true);
  const controllerRef = useRef(null);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPending(true);
    setError('');

    try {
      const response = await fetch('/api/santa-workshop-usage', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) {
        setUsage(null);
        setError(getErrorMessage(response.status));
        return;
      }
      const result = await response.json();
      if (!isUsageResponse(result)) {
        setError('The usage service returned an unexpected response. Please try refreshing.');
        return;
      }
      setUsage(result);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') {
        setError('We could not reach the usage service. Check your connection and try again.');
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setPending(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, [refresh]);

  const firstEntryAt = formatUKDate(usage?.firstEntryAt);
  const hasAnyUsage = usage && metrics.some(metric => usage[metric.key] > 0);

  return (
    <section id="school-voucher-usage" className="school-voucher-usage staff-panel" aria-labelledby="school-voucher-usage-title">
      <div className="school-voucher-usage__heading">
        <div>
          <p className="school-voucher-usage__kicker">Private staff report</p>
          <h2 id="school-voucher-usage-title">Voucher usage</h2>
          <p className="school-voucher-usage__voucher">Usage by active tester voucher</p>
        </div>
        <button
          className="staff-button"
          type="button"
          onClick={refresh}
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? 'Refreshing…' : 'Refresh totals'}
        </button>
      </div>

      <p className="staff-info" role="note">
        Tracked activity only. Entries and recordings may be missing during reporting outages.
        Missing activity cannot be reconstructed from these totals.
      </p>

      {error && (
        <div className="staff-error school-voucher-usage__error" role="alert">
          <p>{error}</p>
          <button className="staff-text-action" type="button" onClick={refresh} disabled={pending}>
            Try again
          </button>
        </div>
      )}

      {pending && !usage && !error && (
        <div className="school-voucher-usage__metrics" aria-label="Loading voucher usage totals" aria-busy="true">
          {metrics.map(metric => (
            <div className="school-voucher-usage__metric school-voucher-usage__metric--loading" key={metric.key}>
              <span className="school-voucher-usage__skeleton" />
              <span className="school-voucher-usage__skeleton school-voucher-usage__skeleton--label" />
            </div>
          ))}
        </div>
      )}

      {usage && !pending && !error && (
        <>
          <p role="status">Reporting data loaded successfully. This does not confirm uninterrupted tracking.</p>
          {hasAnyUsage ? (
            <div className="school-voucher-usage__metrics" aria-label="Voucher usage totals">
              {metrics.map(metric => (
                <article className="school-voucher-usage__metric" key={metric.key}>
                  <p className="school-voucher-usage__metric-label">{metric.label}</p>
                  <p className="school-voucher-usage__metric-value">{numberFormat.format(usage[metric.key])}</p>
                  <p className="school-voucher-usage__metric-note">{metric.note}</p>
                </article>
              ))}
            </div>
          ) : (
            <div className="staff-empty school-voucher-usage__zero">
              <h3>No tracked voucher activity yet</h3>
              <p>Counts will appear after a successful voucher session is recorded.</p>
            </div>
          )}

          <div className="school-voucher-usage__first-entry">
            <span>First tracked entry</span>
            <strong>{firstEntryAt || 'No tracked entry yet'}</strong>
          </div>

          <h3 className="school-voucher-usage__list-title">Usage by code</h3>
          {usage.vouchers.length ? (
            <div className="school-voucher-usage__voucher-list">
              {usage.vouchers.map(voucher => (
                <article className="school-voucher-usage__voucher-card" key={voucher.slot}>
                  <div className="school-voucher-usage__voucher-heading">
                    <div>
                      <h4>{voucher.name}</h4>
                      <span className="school-voucher-usage__slot">Code {voucher.slot}</span>
                    </div>
                    <code className="school-voucher-usage__code-value">{voucher.code}</code>
                  </div>
                  <dl className="school-voucher-usage__voucher-metrics">
                    <div><dt>Entries</dt><dd>{numberFormat.format(voucher.entries)}</dd></div>
                    <div><dt>Messages</dt><dd>{numberFormat.format(voucher.messages)}</dd></div>
                    <div><dt>Corrections</dt><dd>{numberFormat.format(voucher.corrections)}</dd></div>
                    <div><dt>Total recordings</dt><dd>{numberFormat.format(voucher.totalRecordings)}</dd></div>
                    <div><dt>Another test started</dt><dd>{numberFormat.format(voucher.startedAnother)}</dd></div>
                  </dl>
                  <p className="school-voucher-usage__voucher-first">
                    First tracked entry: {formatUKDate(voucher.firstEntryAt) || 'None yet'}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="staff-empty school-voucher-usage__zero">
              <h3>No active tester codes are configured</h3>
            </div>
          )}

          <div className="staff-info school-voucher-usage__details">
            <p>
              An entry is a successful voucher login, not a count of unique parents. Messages count first
              successful recordings; corrections are counted separately. Deliberately starting another
              test creates another message, not another voucher entry.
            </p>
            <p>
              These totals cover successfully tracked sessions after tracking was enabled. Earlier history
              and activity missed during reporting outages are not backfilled. A zero means no tracked
              activity, not proof that nobody used a voucher. No child details are included. Downloads are not measured.
            </p>
          </div>
        </>
      )}
      <StudioStorageDiagnostic />
      <StudioOwnerReadiness />
    </section>
  );
}
