import FoldingVideoPlayer from './FoldingVideoPlayer.jsx';
import { useEffect, useRef, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';

export const VIDEO_EXAMPLES = ['Charlotte', 'Arabella', 'Harry'].map(name => ({
  name,
  src: `/video/examples/santa-message-${name.toLowerCase()}-supplied-v1.mp4`,
  poster: `/images/santa-message-${name.toLowerCase()}-supplied-v1.jpg`,
}));
export function nextVideoExample(previous, random = Math.random) {
  const choices = VIDEO_EXAMPLES.filter(example => example.name !== previous);
  return choices[Math.min(choices.length - 1, Math.floor(Math.max(0, random()) * choices.length))];
}
const ROTATION_KEY = 'santa-video-example-last';
export default function SantaMessageVideoExample() {
  const radio = useRadio();
  const resume = useRef(null);
  const [example, setExample] = useState(VIDEO_EXAMPLES[0]);
  const finish = () => { const restore = resume.current; resume.current = null; restore?.(); };
  const choose = previous => {
    const next = nextVideoExample(previous);
    setExample(next);
    try { sessionStorage.setItem(ROTATION_KEY, next.name); } catch { /* Rotation still works without storage. */ }
  };
  useEffect(() => {
    let previous;
    try { previous = sessionStorage.getItem(ROTATION_KEY); } catch { /* Optional browser storage. */ }
    choose(previous);
    return () => { resume.current?.(); resume.current = null; };
  }, []);
  return <figure className="fsm-video-preview">
    <FoldingVideoPlayer key={example.src} preload="none"
      poster={example.poster} src={example.src}
      label={`Play an example Santa video message for ${example.name}`}
      onPlay={() => {
        document.querySelectorAll('.message-result audio, .message-result video').forEach(media => media.pause());
        if (!resume.current) resume.current = radio?.pauseForMessage();
      }} onPause={finish} onEnded={finish} onError={finish} />
  </figure>;
}
