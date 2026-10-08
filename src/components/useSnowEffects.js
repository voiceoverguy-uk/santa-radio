import { useCallback, useEffect, useState } from 'react';

const PREFERENCE_KEY = 'santa-snow-preference';
const MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function readPreference() {
  try {
    const saved = localStorage.getItem(PREFERENCE_KEY);
    if (saved === 'on' || saved === 'off') return saved;
    // The old implementation saved "on" automatically on every visit, so it
    // cannot be treated as deliberate permission to override reduced motion.
    if (localStorage.getItem('santa-effects') === 'off') return 'off';
  } catch { /* Snow still works when browser storage is unavailable. */ }
  return 'auto';
}

export default function useSnowEffects() {
  const [preference, setPreference] = useState(readPreference);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia(MOTION_QUERY).matches,
  );
  const effects = preference === 'on' || (preference === 'auto' && !reducedMotion);

  useEffect(() => {
    const media = window.matchMedia(MOTION_QUERY);
    const update = () => setReducedMotion(media.matches);
    update();
    if (media.addEventListener) {
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }
    media.addListener(update);
    return () => media.removeListener(update);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.effects = effects ? 'on' : 'off';
    root.dataset.snowMotion = preference === 'on' ? 'on' : 'auto';
    // Persist only explicit choices, never the automatic device-based default.
    if (preference === 'auto') return;
    try {
      localStorage.setItem(PREFERENCE_KEY, preference);
      localStorage.setItem('santa-effects', preference);
    } catch { /* Storage is optional; the switch still works for this visit. */ }
  }, [effects, preference]);

  const setEffects = useCallback(value => {
    setPreference(previous => {
      const current = previous === 'on' || (previous === 'auto' && !reducedMotion);
      const next = typeof value === 'function' ? value(current) : value;
      return next ? 'on' : 'off';
    });
  }, [reducedMotion]);

  return { effects, setEffects };
}
