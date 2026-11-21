import { useEffect, useState } from 'react';
import { StudioScenePicture } from './StudioScenePicker.jsx';
import { STUDIO_VIDEO_SCENES } from '../lib/studioVideo.js';

export default function StudioOpeningPicture({ initialIndex = 0, caption }) {
  const [index, setIndex] = useState(initialIndex);
  const [paused, setPaused] = useState(true);
  const [hovered, setHovered] = useState(false);
  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPaused(preference.matches);
    const change = () => setPaused(preference.matches);
    preference.addEventListener('change', change);
    return () => preference.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (paused || hovered) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex(current => (current + 1) % STUDIO_VIDEO_SCENES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [paused, hovered]);
  return <div className="smw-opening-picture" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
    <button type="button" className="smw-opening-pause" onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setPaused(true); }}
      onClick={() => setPaused(current => !current)} aria-label={paused ? 'Play picture slideshow' : 'Pause picture slideshow'}>
      {paused ? 'Play pictures' : 'Pause pictures'}
    </button>
    <StudioScenePicture scene={STUDIO_VIDEO_SCENES[index]} alt={STUDIO_VIDEO_SCENES[index].label} caption={caption} animate />
  </div>;
}
