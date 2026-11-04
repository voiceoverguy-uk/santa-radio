import './MessageCreationIndicator.css';

// Status wording and announcements belong to the caller. This bar is
// indeterminate: never expose a made-up percentage or a second live region.
export default function MessageCreationIndicator() {
  return <div className="message-creation-indicator" role="progressbar"
    aria-label="Preparing your message" aria-live="off">
    <span className="message-creation-indicator__segment" />
  </div>;
}
