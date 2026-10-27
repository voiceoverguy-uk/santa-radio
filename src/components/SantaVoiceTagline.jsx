import { useId, useState } from 'react';

export default function SantaVoiceTagline() {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="santa-voice-tagline"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={event => {
        if (!event.currentTarget.contains(document.activeElement)) setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <h3 className="santa-message-subheading">Their name. Santa’s{' '}
        <button type="button" className="santa-real-voice" aria-describedby={tooltipId}
          onClick={() => setOpen(true)}>REAL VOICE.</button>
      </h3>
      <span className="santa-voice-tooltip" id={tooltipId} role="tooltip" hidden={!open}>
        This is NOT another AI voice
      </span>
    </div>
  );
}
