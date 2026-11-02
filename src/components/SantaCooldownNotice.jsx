import { messageAvailabilityMessage } from '../lib/santaMessageAllowance.js';

export default function SantaCooldownNotice({ availableAt }) {
  return (
    <p className="message-cooldown-status" role="status">
      {messageAvailabilityMessage(availableAt)}
    </p>
  );
}
