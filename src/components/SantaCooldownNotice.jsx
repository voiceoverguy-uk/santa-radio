export default function SantaCooldownNotice({ secondsLeft }) {
  const total = Math.max(0, Math.ceil(secondsLeft || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const remaining = [hours ? `${hours}h` : '', `${minutes}m`, `${seconds}s`].filter(Boolean).join(' ');
  return (
    <p className="message-cooldown-status" role="timer" aria-live="off">
      {total ? `Your next free message available in ${remaining}.` : 'Your next free message is available now.'}
    </p>
  );
}
