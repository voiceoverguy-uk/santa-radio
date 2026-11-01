import { useEffect, useState } from 'react';

// Presentation only: search and recording selection still use the real inventory.
export default function useSantaNameCounter(total) {
  const [displayed, setDisplayed] = useState(null);
  const available = Number.isSafeInteger(total) && total >= 0;

  useEffect(() => {
    if (!available) {
      setDisplayed(null);
      return;
    }
    setDisplayed(value => value === null ? Math.max(0, total - 50) : Math.min(value, total));
  }, [total, available]);

  useEffect(() => {
    if (!available || displayed === null || displayed >= total) return;
    const timer = setTimeout(() => {
      setDisplayed(value => Math.min(total, (value ?? Math.max(0, total - 50)) + 1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [total, available, displayed]);

  return available ? Math.min(total, displayed ?? Math.max(0, total - 50)) : null;
}
