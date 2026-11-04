import { useEffect, useState } from 'react';

// Page-local, non-recipient cache. No localStorage, names or seed changes.
export const regionalEditorialKey = (parentId, regionId) => JSON.stringify([parentId, regionId]);
export default function useStudioRegionalEditorial(parentId, regionId) {
  const [contexts, setContexts] = useState({});
  const [failure, setFailure] = useState('');
  const [retry, setRetry] = useState(0);
  const key = regionalEditorialKey(parentId, regionId);
  const context = contexts[key];
  useEffect(() => {
    setFailure('');
    if (!regionId || context) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let active = true;
    (async () => {
      try {
        const query = new URLSearchParams({ parentId, regionId });
        const response = await fetch(`/api/santa-workshop-catalogue?${query}`, {
          cache: 'no-store', signal: controller.signal, headers: { Accept: 'application/json' },
        });
        if (response.status === 403) window.dispatchEvent(new Event('santa-workshop-access-change'));
        if (!response.ok) throw new Error('Could not load the selected destination writing.');
        const payload = await response.json(), result = payload.letterContext;
        if (payload.parentId !== parentId || payload.regionId !== regionId || !result ||
          !['real', 'neutral'].includes(result.group) || typeof result.needsReview !== 'boolean' ||
          (result.group === 'real' && (!Array.isArray(result.passages) ||
            result.passages.length < 2 || result.passages.length > 3 ||
            !result.passages.every(passage => typeof passage === 'string' && passage.length < 600)))) {
          throw new Error('Invalid destination writing.');
        }
        if (active) setContexts(current => ({ ...current, [key]: result }));
      } catch {
        if (active) setFailure(key);
      } finally { clearTimeout(timeout); }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [key, parentId, regionId, context, retry]);
  return { ready: !regionId || !!context, failed: failure === key,
    retry: () => setRetry(value => value + 1),
    getContext: (parent, region) => contexts[regionalEditorialKey(parent, region)] };
}
