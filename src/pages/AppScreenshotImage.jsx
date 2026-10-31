import { useEffect, useRef, useState } from 'react';

// Retain the approved WebP, but recover from delivery OR decode failures using
// an exact-pixel PNG. Retry only once; a broken fallback remains an explicit error.
export default function AppScreenshotImage({ slide, index, onReady, onFailure, ...props }) {
  const [fallback, setFallback] = useState(false);
  const imageRef = useRef(null);
  const source = fallback ? slide.fallback : slide.image;

  useEffect(() => {
    const image = imageRef.current;
    let cancelled = false;
    let checking = false;
    const failed = () => {
      if (cancelled) return;
      if (!fallback && slide.fallback) setFallback(true);
      else onFailure(index);
    };
    const loaded = async () => {
      if (checking || cancelled) return;
      checking = true;
      try {
        await image.decode();
        if (!cancelled) onReady(index);
      } catch {
        failed();
      }
    };
    image.addEventListener('load', loaded);
    image.addEventListener('error', failed);
    // SSR/preloaded images can finish before hydration attaches load handlers.
    if (image.complete) {
      if (image.naturalWidth > 0) loaded();
      else failed();
    }
    return () => {
      cancelled = true;
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', failed);
    };
  }, [source, fallback, slide.fallback, index, onReady, onFailure]);

  return <img ref={imageRef} src={source} width={slide.width} height={slide.height}
    alt={slide.alt} decoding="async" {...props} />;
}
