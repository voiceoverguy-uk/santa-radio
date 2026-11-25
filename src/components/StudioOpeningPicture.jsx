import { useEffect, useState } from 'react';
import { StudioScenePicture } from './StudioScenePicker.jsx';
import { STUDIO_VIDEO_SCENES } from '../lib/studioVideo.js';

export default function StudioOpeningPicture({ initialIndex = 0, caption, still = false }) {
  const [index, setIndex] = useState(initialIndex);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [hovered, setHovered] = useState(false);
  useEffect(() => { setIndex(initialIndex); }, [initialIndex]);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(preference.matches);
    const change = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', change);
    return () => preference.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (still || reducedMotion || hovered) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex(current => (current + 1) % STUDIO_VIDEO_SCENES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [still, reducedMotion, hovered]);
  return <div className="smw-opening-picture" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
    <StudioScenePicture scene={STUDIO_VIDEO_SCENES[index]} alt={STUDIO_VIDEO_SCENES[index].label} caption={caption} animate={!still} />
  </div>;
}
