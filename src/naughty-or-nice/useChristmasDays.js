import { useEffect, useState } from 'react';
import { daysUntilChristmas } from './christmasDays.js';

export default function useChristmasDays(active) {
  const [days, setDays] = useState(() => daysUntilChristmas());
  useEffect(() => {
    if (!active) return;
    const refresh = () => setDays(daysUntilChristmas());
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [active]);
  return days;
}
