import { useState, useEffect } from 'react';

function getTimeToChristmas() {
  const now = new Date();
  const year = now.getMonth() === 11 && now.getDate() > 25 ? now.getFullYear() + 1 : now.getFullYear();
  const diff = Math.max(0, new Date(year, 11, 25) - now);
  return { days: Math.floor(diff / 86400000), hours: Math.floor(diff / 3600000) % 24, minutes: Math.floor(diff / 60000) % 60, seconds: Math.floor(diff / 1000) % 60 };
}
export default function Countdown() {
  const [time, setTime] = useState(getTimeToChristmas);
  useEffect(() => { const timer = setInterval(() => setTime(getTimeToChristmas()), 1000); return () => clearInterval(timer); }, []);
  const now = new Date();
  if (now.getMonth() === 11 && now.getDate() === 25) return <p className="christmas-greeting">Merry Christmas from Santa Radio!</p>;
  return <div className="countdown" aria-label="Countdown to Christmas Day">{Object.entries(time).map(([label, value]) => <div className="countdown-unit" key={label}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>)}</div>;
}
