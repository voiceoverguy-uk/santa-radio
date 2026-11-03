import { useEffect, useState } from 'react';
import { loadRecipientFont, RECIPIENT_FONT_READY } from '../lib/giftFonts.js';

// Hide unmeasured names rather than briefly painting a wrong fallback font.
// Retry transient failures, and cancel stale measurements after spelling edits.
export default function useGiftNameFit(name, artwork, fitName) {
  const [measured, setMeasured] = useState(null);
  useEffect(() => {
    let cancelled = false, timer, attempts = 0;
    const measure = async () => {
      clearTimeout(timer);
      try {
        await loadRecipientFont();
        if (cancelled) return;
        const context = document.createElement('canvas').getContext('2d');
        setMeasured({ name, artwork, ...fitName(context, name, artwork) });
      } catch {
        if (!cancelled && ++attempts < 3) timer = setTimeout(measure, 2000);
      }
    };
    measure();
    window.addEventListener('online', measure);
    window.addEventListener('focus', measure);
    window.addEventListener(RECIPIENT_FONT_READY, measure);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('online', measure);
      window.removeEventListener('focus', measure);
      window.removeEventListener(RECIPIENT_FONT_READY, measure);
    };
  }, [name, artwork, fitName]);
  return measured?.name === name && measured?.artwork === artwork ? measured : null;
}
