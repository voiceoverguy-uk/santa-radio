import { messageAvailabilityTime } from '../lib/santaMessageAllowance.js';

export default function SantaCooldownNotice({ availableAt }) {
  return (
    <p className="message-cooldown-status" role="status">
      {`Your next free message will be available at ${messageAvailabilityTime(availableAt)}.`}
    </p>
  );
}
