import { useId, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { STUDIO_VIDEO_ARTWORK, STUDIO_VIDEO_SCENES } from '../lib/studioVideo.js';
import { STUDIO_SCENE_INSET, STUDIO_VIDEO_WIDTH, STUDIO_VIDEO_HEIGHT } from '../lib/studioVideoTimeline.js';

const sceneInset = {
  left: `${100 * STUDIO_SCENE_INSET.x / STUDIO_VIDEO_WIDTH}%`,
  top: `${100 * STUDIO_SCENE_INSET.y / STUDIO_VIDEO_HEIGHT}%`,
  width: `${100 * STUDIO_SCENE_INSET.width / STUDIO_VIDEO_WIDTH}%`,
  height: `${100 * STUDIO_SCENE_INSET.height / STUDIO_VIDEO_HEIGHT}%`,
};

export function StudioScenePicture({ scene, caption, alt = '' }) {
  return <span className="smw-scene-picture" style={{ backgroundImage: `url(${STUDIO_VIDEO_ARTWORK})` }}>
    <img className="smw-scene-art" src={scene.src} alt={alt} width="1280" height="540" style={sceneInset} />
    {caption && <span className="smw-scene-caption">{caption}</span>}
  </span>;
}

export default function StudioScenePicker({ selected, onSelect, recipientCaption }) {
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
        <StudioScenePicture scene={option} caption={option.label} />
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
        <StudioScenePicture scene={scene} caption={recipientCaption} />
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
