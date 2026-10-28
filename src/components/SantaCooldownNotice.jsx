import { messageAvailabilityTime } from '../lib/santaMessageAllowance.js';

export default function SantaCooldownNotice({ availableAt }) {
  return (
    <p className="message-cooldown-status" role="status">
      Your recording isn’t saved by this site, so it isn’t available after a reload. {`Your next free message will be available at ${messageAvailabilityTime(availableAt)}.`}
    </p>
  );
}
