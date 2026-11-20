import { useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { STUDIO_VIDEO_SCENES } from '../lib/studioVideo.js';
import { STUDIO_SCENE_BRAND } from '../lib/studioVideoTimeline.js';

function ScenePicture({ scene }) {
  return <span className="smw-scene-picture">
    <img src={scene.src} alt="" width="1280" height="540" />
    <span className="smw-scene-brand" aria-hidden="true">
      <strong>{STUDIO_SCENE_BRAND[0]}</strong>
      <em>{STUDIO_SCENE_BRAND[1]}</em>
    </span>
  </span>;
}

export default function StudioScenePicker({ selected, onSelect }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const [index, setIndex] = useState(0);
  const scene = STUDIO_VIDEO_SCENES[index];
  const browse = direction => setIndex(current =>
    (current + direction + STUDIO_VIDEO_SCENES.length) % STUDIO_VIDEO_SCENES.length);

  return <>
    <div className="smw-scene-options" role="group" aria-label="Choose a picture">
      {STUDIO_VIDEO_SCENES.map((option, position) => <button key={option.src} type="button"
        aria-haspopup="dialog" aria-pressed={selected === option.src} onClick={() => {
          setIndex(position);
          dialogRef.current.showModal();
        }}>
        <ScenePicture scene={option} />
        <span className="smw-scene-caption">{option.label}</span>
      </button>)}
    </div>
    <dialog ref={dialogRef} className="smw-scene-dialog" aria-labelledby={titleId} onKeyDown={event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        browse(event.key === 'ArrowLeft' ? -1 : 1);
      }
    }}>
      <div className="smw-scene-dialog__header">
        <h3 id={titleId} aria-live="polite">{scene.label}</h3>
        <button type="button" className="smw-change" onClick={() => dialogRef.current.close()}>Close preview</button>
      </div>
      <div className="smw-scene-dialog__picture">
        <ScenePicture scene={scene} />
        <button type="button" className="smw-scene-dialog__arrow" aria-label="Previous picture" onClick={() => browse(-1)}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <button type="button" className="smw-scene-dialog__arrow" aria-label="Next picture" onClick={() => browse(1)}>
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
      <div className="smw-actions">
        <button type="button" className="smw-button smw-button-next" onClick={() => {
          onSelect(scene.src);
          dialogRef.current.close();
        }}>Use this picture →</button>
      </div>
    </dialog>
  </>;
}
