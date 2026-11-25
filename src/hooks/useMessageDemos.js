import { useEffect, useState } from 'react';

export function demoEndpoint(group) {
  return '/api/message-demos?group=' + encodeURIComponent(group);
}

export async function fetchDemos(group, signal) {
  const response = await fetch(demoEndpoint(group), {cache:'no-store', signal});
  if (!response.ok) throw new Error('The demo library could not be loaded.');
  const {demos} = await response.json();
  return demos;
}

export default function useMessageDemos(group) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchDemos(group, controller.signal).then(demos => {
      if (!controller.signal.aborted) setResult({group, demos});
    }).catch(() => {});
    return () => controller.abort();
  }, [group]);
  return result?.group === group ? result.demos : [];
}
