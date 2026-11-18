import { useEffect, useRef } from 'react';
import { useRadio } from './RadioProvider.jsx';

export default function SantaMessageVideoExample() {
  const radio = useRadio();
  const resume = useRef(null);
  const finish = () => { const restore = resume.current; resume.current = null; restore?.(); };
  useEffect(() => () => { resume.current?.(); resume.current = null; }, []);
  return <figure className="fsm-video-preview">
    <video controls playsInline preload="none"
      poster="/images/santa-message-harry-video-poster.jpg"
      src="/video/examples/santa-message-harry.mp4"
      aria-label="Play an example Santa video message for Harry"
      onPlay={() => {
        document.querySelectorAll('.message-result audio, .message-result video').forEach(media => media.pause());
        if (!resume.current) resume.current = radio?.pauseForMessage();
      }} onPause={finish} onEnded={finish} onError={finish} />
    <figcaption>Watch an example — a message for Harry. Yours will feature your chosen name.</figcaption>
    <a className="btn-red" href="#santa-messages">Create your free message</a>
  </figure>;
}
