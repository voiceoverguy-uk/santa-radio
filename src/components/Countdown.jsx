import { useState, useEffect } from 'react';
import { BLACK_FRIDAY_START } from './BlackFridayOffer.jsx';

const BLACK_FRIDAY_COUNTDOWN_START = Date.parse('2026-11-25T00:00:00Z');

function timeUnits(diff) {
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor(diff / 3600000) % 24,
    minutes: Math.floor(diff / 60000) % 60,
    seconds: Math.floor(diff / 1000) % 60,
  };
}

export default function Countdown({ showBlackFriday = false }) {
  const [now, setNow] = useState(() => new Date());
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  const blackFriday = mounted && showBlackFriday && now >= BLACK_FRIDAY_COUNTDOWN_START && now < BLACK_FRIDAY_START;
  if (!blackFriday && now.getMonth() === 11 && now.getDate() === 25) {
    return <p className="christmas-greeting">Merry Christmas from Santa Radio!</p>;
  }
  const year = now.getFullYear() + (now.getMonth() === 11 && now.getDate() > 25 ? 1 : 0);
  const target = blackFriday ? BLACK_FRIDAY_START : new Date(year, 11, 25).getTime();
  const time = timeUnits(blackFriday ? Math.ceil((target - now) / 1000) * 1000 : Math.max(0, target - now));

  return <>
    <div className="countdown" aria-label={blackFriday ? 'Countdown to the Black Friday offer' : 'Countdown to Christmas Day'}>
      {Object.entries(time).map(([label, value]) => (
        <div className={`countdown-unit${blackFriday ? ' black-friday-paper' : ''}`} key={label}>
          <strong>{String(value).padStart(2, '0')}</strong><span>{label}</span>
        </div>
      ))}
    </div>
    {blackFriday && <p className="black-friday-countdown-label">BLACK FRIDAY COUNTDOWN</p>}
  </>;
}
