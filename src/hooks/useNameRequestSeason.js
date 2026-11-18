import { useEffect, useState } from 'react';
import { nameRequestsOpen } from '../lib/nameRequestSeason.js';

export default function useNameRequestSeason() {
  // Start closed so prerendered pages never preserve an out-of-season button.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const refresh = () => setOpen(nameRequestsOpen());
    refresh();
    const timer = window.setInterval(refresh, 1000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return open;
}
