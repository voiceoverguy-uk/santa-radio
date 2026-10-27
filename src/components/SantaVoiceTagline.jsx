import { useId, useState } from 'react';
import { Info } from 'lucide-react';

export default function SantaVoiceTagline() {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="santa-voice-tagline"
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
      <h3 className="santa-message-subheading">Their name. Santa’s REAL VOICE.{' '}
        <button type="button" className="santa-voice-info" aria-label="About Santa’s real voice" aria-describedby={tooltipId}
          onMouseEnter={() => setOpen(true)}
          onClick={() => setOpen(true)}><Info size={17} aria-hidden="true" /></button>
      </h3>
      <span className="santa-voice-tooltip" id={tooltipId} role="tooltip" hidden={!open}>
        This is NOT another AI voice
      </span>
    </div>
  );
}
