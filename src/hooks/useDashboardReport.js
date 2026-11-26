import { useEffect, useState } from 'react';

// Keep owner-only reports in component memory, shared by the summary and detail views.
export default function useDashboardReport(ownerToken, view, revision = 0) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!ownerToken) {
      setResult(null);
      return;
    }
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 55000);
    const query = view ? '?view=' + encodeURIComponent(view) : '';
    fetch('/api/message-statistics' + query, {
      headers: { Authorization: 'Bearer studio-owner.' + ownerToken },
      cache: 'no-store',
      signal: controller.signal,
    }).then(response => {
      if (!response.ok) throw new Error('Report unavailable');
      return response.json();
    }).then(report => {
      if (active) setResult({ ownerToken, report, error: false });
    }).catch(() => {
      if (active) setResult(previous => ({ ownerToken, report: previous?.ownerToken === ownerToken ? previous.report : null, error: true }));
    }).finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [ownerToken, view, revision, attempt]);
  const current = result?.ownerToken === ownerToken ? result : null;
  return { report: current?.report, error: !!current?.error, refresh: () => setAttempt(n => n + 1) };
}
