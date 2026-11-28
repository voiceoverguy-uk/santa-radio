import { useEffect, useRef, useState } from 'react';

export default function DashboardVideoStitcher({ ownerToken }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const [height, setHeight] = useState(1400);
  const observer = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    setHtml(''); setError('');
    fetch('/api/santa-videos', { headers: { Authorization: `Bearer studio-owner.${ownerToken}` }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw Error('The video stitcher could not load. Reopen this Dashboard section to retry.');
        const page = await response.text();
        const token = JSON.stringify(ownerToken).replaceAll('<', '\\u003c');
        if (!controller.signal.aborted) setHtml(page.replace('<head>', `<head><script>window.__santaVideoOwnerToken=${token};</script>`));
      }).catch(reason => { if (!controller.signal.aborted) setError(reason.message); });
    return () => { controller.abort(); observer.current?.disconnect(); };
  }, [ownerToken]);
  return <section aria-label="Santa video stitcher">
    {!html && <p role="status">{error || 'Opening video stitcher…'}</p>}
    {html && <iframe title="Santa video stitcher" srcDoc={html} style={{ width: '100%', height, border: 0, display: 'block' }} onLoad={event => {
      observer.current?.disconnect();
      const body = event.currentTarget.contentDocument?.body;
      if (!body) return;
      observer.current = new ResizeObserver(() => setHeight(Math.ceil(body.getBoundingClientRect().height) + 48));
      observer.current.observe(body);
    }} />}
  </section>;
}
