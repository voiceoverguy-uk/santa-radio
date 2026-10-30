import { useEffect, useState } from 'react';

// Midnight in London is GMT on the announced November launch date.
const launchTime = Date.parse('2026-11-06T00:00:00Z');

function formatRemaining(seconds) {
  return [
    ['day', Math.floor(seconds / 86400)],
    ['hour', Math.floor(seconds / 3600) % 24],
    ['minute', Math.floor(seconds / 60) % 60],
    ['second', seconds % 60],
  ].map(([unit, value]) => `${value} ${unit}${value === 1 ? '' : 's'}`).join(', ');
}

export default function SantaStudioLaunchCountdown() {
  // Keep the server render and first browser render identical.
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, Math.ceil((launchTime - Date.now()) / 1000)));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return <p className="santa-studio-promotion__launch-countdown" role="timer" aria-live="off"
    title="Opens 6 November 2026 at midnight UK time">
    {remaining === null ? 'Santa’s Message Maker Studio opens 6 November.'
      : remaining === 0 ? 'Santa’s Message Maker Studio — opening day has arrived!'
        : <>Santa’s Message Maker Studio opens in <strong>{formatRemaining(remaining)}</strong></>}
  </p>;
}
