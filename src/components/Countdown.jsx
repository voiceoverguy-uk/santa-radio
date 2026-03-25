import { useState, useEffect } from 'react';

function getTimeToChristmas() {
  const now = new Date();
  const year = now.getMonth() === 11 && now.getDate() > 25 ? now.getFullYear() + 1 : now.getFullYear();
  const christmas = new Date(year, 11, 25, 0, 0, 0);
  const diff = christmas - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
}

export default function Countdown() {
  const [time, setTime] = useState(getTimeToChristmas());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(getTimeToChristmas());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const now = new Date();
  const isChristmas = now.getMonth() === 11 && now.getDate() === 25;

  if (isChristmas) {
    return (
      <div className="countdown">
        <span>🎄 Merry Christmas! 🎅</span>
      </div>
    );
  }

  return (
    <div className="countdown">
      <span className="countdown-label">Christmas Day in: </span>
      <span className="countdown-time">
        {time.days}d {time.hours}h {time.minutes}m {time.seconds}s
      </span>
    </div>
  );
}
