import { useEffect, useRef } from 'react';
import FoldingVideoPlayer from './FoldingVideoPlayer.jsx';
import { useRadio } from './RadioProvider.jsx';
import useVideoDemo from '../hooks/useVideoDemo.js';
import { builtInDemos } from '../lib/messageDemoCatalogue.js';

export { nextVideoExample } from '../hooks/useVideoDemo.js';
export const VIDEO_EXAMPLES = builtInDemos.free;

export default function SantaMessageVideoExample({group = 'free', onExampleNameChange}) {
  const radio = useRadio();
  const restoreVolume = useRef(null);
  const {example, choose} = useVideoDemo(group);
  function finish() {
    const restore = restoreVolume.current;
    restoreVolume.current = null;
    restore?.();
    onExampleNameChange?.(null);
  }
  useEffect(() => () => {
    restoreVolume.current?.(); restoreVolume.current = null;
    onExampleNameChange?.(null);
  }, [onExampleNameChange]);
  if (!example) return null;
  return <figure className="fsm-video-preview">
    <FoldingVideoPlayer key={example.id} preload="none" overlayLabel="Example"
      poster={example.poster} src={example.src} label={'Play ' + example.name + ' example video'}
      onPlay={event => {
        if (!restoreVolume.current) restoreVolume.current = radio?.duckForDemo(event.currentTarget);
        onExampleNameChange?.(example.recipient ?? null);
      }} onPause={finish} onEnded={() => { finish(); choose(); }} onError={finish} />
  </figure>;
}
