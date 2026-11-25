import { useEffect, useRef } from 'react';
import FoldingVideoPlayer from './FoldingVideoPlayer.jsx';
import { useRadio } from './RadioProvider.jsx';
import useVideoDemo from '../hooks/useVideoDemo.js';
import { builtInDemos } from '../lib/messageDemoCatalogue.js';

export { nextVideoExample } from '../hooks/useVideoDemo.js';
export const VIDEO_EXAMPLES = builtInDemos.free;

export default function SantaMessageVideoExample({group = 'free', onExampleNameChange}) {
  const radio = useRadio();
  const resume = useRef(null);
  const {example, choose} = useVideoDemo(group);
  function finish() {
    const restore = resume.current;
    resume.current = null;
    restore?.();
    onExampleNameChange?.(null);
  }
  useEffect(() => () => {
    resume.current?.(); resume.current = null;
    onExampleNameChange?.(null);
  }, [onExampleNameChange]);
  if (!example) return null;
  return <figure className="fsm-video-preview">
    <FoldingVideoPlayer key={example.id} preload="none" overlayLabel="Example"
      poster={example.poster} src={example.src} label={'Play ' + example.name + ' example video'}
      onPlay={event => {
        document.querySelectorAll('audio,video').forEach(media => { if (media !== event.currentTarget) media.pause(); });
        if (!resume.current) resume.current = radio?.pauseForMessage();
        onExampleNameChange?.(example.recipient ?? null);
      }} onPause={finish} onEnded={() => { finish(); choose(); }} onError={finish} />
  </figure>;
}
