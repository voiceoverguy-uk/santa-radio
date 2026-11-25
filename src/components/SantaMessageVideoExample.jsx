import FoldingVideoPlayer from './FoldingVideoPlayer.jsx';
import { useEffect, useRef, useState } from 'react';
import { useRadio } from './RadioProvider.jsx';

export const VIDEO_EXAMPLES = ['01', '02', '03', '04'].map(id => ({
  id,
  src: `/video/examples/free-santa-message-example-${id}.mp4`,
  poster: `/video/examples/free-santa-message-example-${id}.jpg`,
}));

export function nextVideoExample(recent, random = Math.random) {
  const unused = VIDEO_EXAMPLES.filter(example => !recent.includes(example.id));
  const choices = unused.length ? unused : VIDEO_EXAMPLES.filter(example => example.id !== recent.at(-1));
  const next = choices[Math.min(choices.length - 1, Math.floor(Math.max(0, random()) * choices.length))];
  return { next, recent: [...(unused.length ? recent : []), next.id] };
}

const ROTATION_KEY = 'santa-video-example-rotation-v2';
export default function SantaMessageVideoExample() {
  const radio = useRadio();
  const resume = useRef(null);
  const recent = useRef([]);
  const initialized = useRef(false);
  const [example, setExample] = useState(VIDEO_EXAMPLES[0]);
  const finish = () => { const restore = resume.current; resume.current = null; restore?.(); };
  const choose = () => {
    const choice = nextVideoExample(recent.current);
    recent.current = choice.recent;
    setExample(choice.next);
    try { sessionStorage.setItem(ROTATION_KEY, JSON.stringify(recent.current)); } catch { /* Rotation still works without storage. */ }
  };
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      try {
        const saved = JSON.parse(sessionStorage.getItem(ROTATION_KEY) || '[]');
        recent.current = Array.isArray(saved) ? [...new Set(saved.filter(id => VIDEO_EXAMPLES.some(example => example.id === id)))] : [];
      } catch { /* Storage is optional. */ }
      choose();
    }
    return () => { resume.current?.(); resume.current = null; };
  }, []);
  return <figure className="fsm-video-preview">
    <FoldingVideoPlayer key={example.src} preload="none" overlayLabel="Example"
      poster={example.poster} src={example.src} label="Play an example Santa video message"
      onPlay={() => {
        document.querySelectorAll('.message-result audio, .message-result video').forEach(media => media.pause());
        if (!resume.current) resume.current = radio?.pauseForMessage();
      }} onPause={finish} onEnded={() => { finish(); choose(); }} onError={finish} />
  </figure>;
}
