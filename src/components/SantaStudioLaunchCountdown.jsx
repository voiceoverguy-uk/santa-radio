import useSantaStudioLaunch from './useSantaStudioLaunch.js';

function formatRemaining(seconds) {
  return [
    ['day', Math.floor(seconds / 86400)],
    ['hour', Math.floor(seconds / 3600) % 24],
    ['minute', Math.floor(seconds / 60) % 60],
    ['second', seconds % 60],
  ].map(([unit, value]) => `${value} ${unit}${value === 1 ? '' : 's'}`).join(', ');
}

export default function SantaStudioLaunchCountdown() {
  const { remaining } = useSantaStudioLaunch();

  return <p className="santa-studio-promotion__launch-countdown" role="timer" aria-live="off"
    title="Opens 6 November 2026 at midnight UK time">
    {remaining === null ? 'Santa’s Message Maker Studio opens 6 November.'
      : remaining === 0 ? 'Santa’s Message Maker Studio — opening day has arrived!'
        : <>Santa’s Message Maker Studio opens in <strong>{formatRemaining(remaining)}</strong></>}
  </p>;
}
