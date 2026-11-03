import { useEffect, useRef, useState } from 'react';
import './StudioStorageDiagnostic.css';

const problems = {
  database_not_configured: 'No database connection is configured.',
  invalid_database_configuration: 'The database connection configuration is invalid.',
  database_permissions: 'The database role does not have the required access.',
  table_or_columns_missing: 'A required table or column is missing.',
  database_unavailable: 'The database could not be checked.',
};
const readiness = [
  ['access', 'Voucher security'], ['generation', 'Recording storage'], ['reporting', 'Usage reporting'],
];
const valid = data => data?.kind === 'studio-storage-diagnostic'
  && typeof data.checkedAt === 'string' && Number.isFinite(Date.parse(data.checkedAt))
  && typeof data.runtime?.host === 'string' && typeof data.runtime?.environment === 'string'
  && typeof data.database?.connected === 'boolean' && typeof data.database?.configured === 'boolean'
  && [data.runtime.deployment, data.database.host, data.database.name]
    .every(value => value === null || typeof value === 'string')
  && typeof data.storage?.checked === 'boolean' && typeof data.storage?.ready === 'boolean'
  && Array.isArray(data.tables) && data.tables.every(table => typeof table.name === 'string'
    && typeof table.present === 'boolean'
    && ['read', 'insert', 'update', 'delete'].every(key => typeof table.permissions?.[key] === 'boolean'));

export default function StudioStorageDiagnostic() {
  const [pending, setPending] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const request = useRef(null);
  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);
  async function check() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => controller.abort(), 30000);
    setPending(true); setReport(null); setError('');
    try {
      const response = await fetch('/api/santa-workshop-usage?diagnostic=recording-storage', {
        credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403
        ? 'Sign in with an approved staff account to run this check.'
        : 'The diagnostic could not be loaded. Please try again.');
      const result = await response.json();
      if (!valid(result)) throw new Error('The diagnostic returned an unexpected response.');
      if (request.current === controller) setReport(result);
    } catch (failure) {
      if (request.current === controller) setError(failure.name === 'AbortError'
        ? 'The diagnostic timed out. Please try again.' : failure instanceof TypeError
          ? 'The diagnostic could not connect. Please try again.' : failure.message);
    } finally {
      clearTimeout(timer);
      if (request.current === controller) { request.current = null; setPending(false); }
    }
  }
  return (
    <section className="studio-storage-diagnostic" aria-labelledby="studio-storage-diagnostic-title">
      <h3 id="studio-storage-diagnostic-title">Recording service diagnostic</h3>
      <p>Approved staff only. This optional check reads database identity and schema information,
        not user records or audio. It does not create tables, generate messages or change storage.</p>
      <button className="staff-button" type="button" onClick={check} disabled={pending} aria-busy={pending}>
        {pending ? 'Checking recording storage…' : 'Check recording storage'}
      </button>
      {error && <p role="alert">{error}</p>}
      {report && (
        <div className="studio-storage-diagnostic__result">
          <p role="status">{report.database.connected
            ? 'Connected to this runtime’s database. This is a schema check, not a successful MP3 test.'
            : 'This runtime’s database could not be connected or checked.'}</p>
          <dl>
            <div><dt>Runtime</dt><dd>{report.runtime.host} · {report.runtime.environment}</dd></div>
            <div><dt>Deployment</dt><dd>{report.runtime.deployment || 'Not supplied by this runtime'}</dd></div>
            <div><dt>Database host</dt><dd>{report.database.host || 'Unavailable'}</dd></div>
            <div><dt>Database name</dt><dd>{report.database.name || 'Unavailable'}</dd></div>
            <div><dt>Checked at</dt><dd>{report.checkedAt}</dd></div>
          </dl>
          <p>This identifies the connection used by this request. A Preview result does not verify live Vercel.
            Host and database name must be compared with the intended database before any changes.</p>
          {report.database.reason && <p>{problems[report.database.reason] || 'Database check unavailable.'}</p>}
          <ul>
            {readiness.map(([key, label]) => {
              const item = report.storage[key];
              return <li key={key}><strong>{label}:</strong> {!item?.checked ? 'Not checked'
                : item.ready ? 'Schema checks passed' : problems[item.reason] || 'Schema or permission checks failed'}</li>;
            })}
          </ul>
          {report.tables.length > 0 && <div className="studio-storage-diagnostic__table-wrap">
            <table>
              <caption>Table presence and role permissions (not all operations are required)</caption>
              <thead><tr><th scope="col">Table</th><th scope="col">Present</th>
                <th scope="col">Read</th><th scope="col">Insert</th><th scope="col">Update</th><th scope="col">Delete</th></tr></thead>
              <tbody>{report.tables.map(table => <tr key={table.name}>
                <th scope="row">{table.name}</th><td>{table.present ? 'Yes' : 'No'}</td>
                {['read', 'insert', 'update', 'delete'].map(key =>
                  <td key={key}>{!table.present ? '—' : table.permissions[key] ? 'Yes' : 'No'}</td>)}
              </tr>)}</tbody>
            </table>
          </div>}
          <p><strong>Audio retention:</strong> new recordings keep metadata only in shared storage;
            finished MP3s stay in request/browser memory. Existing legacy records are not deleted.
            Passing schema checks does not prove that audio rendering works.</p>
        </div>
      )}
    </section>
  );
}
