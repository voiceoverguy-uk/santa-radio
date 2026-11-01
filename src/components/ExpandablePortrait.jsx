import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Portrait from './Portrait.jsx';
import './ExpandablePortrait.css';

// The original frame stays in the document. Only the photograph floats above it.
export default function ExpandablePortrait({ src, alt }) {
  const frame = useRef(null);
  const trigger = useRef(null);
  const floating = useRef(null);
  const animation = useRef(null);
  const request = useRef(0);
  const closing = useRef(false);
  const [ready, setReady] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const image = frame.current?.querySelector('img');
    if (image?.complete && image.naturalWidth) setReady(true);
    return () => {
      request.current++;
      animation.current?.cancel();
    };
  }, []);

  function origin(ratio) {
    const box = frame.current.getBoundingClientRect();
    const width = Math.min(box.width, box.height * ratio);
    const height = width / ratio;
    return { left: box.left + (box.width - width) / 2,
      top: box.top + (box.height - height) / 2, width, height };
  }

  function destination(ratio) {
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const margin = Math.min(24, width * 0.04);
    const photoWidth = Math.min(width - margin * 2, (height - margin * 2) * ratio);
    return { left: (viewport?.offsetLeft || 0) + (width - photoWidth) / 2,
      top: (viewport?.offsetTop || 0) + (height - photoWidth / ratio) / 2,
      width: photoWidth, height: photoWidth / ratio };
  }

  function move(from, to, done) {
    animation.current?.cancel();
    const node = floating.current;
    Object.assign(node.style, { left: `${to.left}px`, top: `${to.top}px`,
      width: `${to.width}px`, height: `${to.height}px`, visibility: 'visible' });
    const noMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.effects === 'off';
    if (noMotion) {
      done?.();
      return;
    }
    const running = node.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})` },
      { transform: 'none' },
    ], { duration: 260, easing: 'cubic-bezier(.2,.7,.2,1)' });
    animation.current = running;
    running.finished.then(() => {
      if (animation.current === running) {
        animation.current = null;
        done?.();
      }
    }).catch(() => {}); // Cancellation is expected on resize, dismissal or unmount.
  }

  function collapse(restoreFocus = true) {
    request.current++;
    setPending(false);
    if (!floating.current || closing.current) return;
    closing.current = true;
    if (restoreFocus) trigger.current?.focus({ preventScroll: true });
    move(floating.current.getBoundingClientRect(), origin(photo.ratio), () => {
      setPhoto(null);
      closing.current = false;
    });
  }

  function expand() {
    if (photo) { collapse(); return; }
    if (!ready || !src) return;
    const id = ++request.current;
    setPending(true);
    // Load the existing original, not the 320/640px responsive thumbnail.
    const original = new Image();
    original.onload = () => {
      if (id !== request.current || !original.naturalWidth) return;
      setPending(false);
      setPhoto({ ratio: original.naturalWidth / original.naturalHeight });
    };
    original.onerror = () => {
      if (id === request.current) {
        setPending(false);
        setReady(false);
      }
    };
    original.src = src;
  }

  useEffect(() => {
    if (!pending) return;
    const cancel = event => {
      if ((event.type === 'keydown' && event.key === 'Escape') ||
        (event.type !== 'keydown' && !frame.current?.contains(event.target))) {
        request.current++;
        setPending(false);
      }
    };
    document.addEventListener('pointerdown', cancel);
    document.addEventListener('focusin', cancel);
    document.addEventListener('keydown', cancel);
    return () => {
      document.removeEventListener('pointerdown', cancel);
      document.removeEventListener('focusin', cancel);
      document.removeEventListener('keydown', cancel);
    };
  }, [pending]);

  useEffect(() => {
    if (!photo) return;
    const node = floating.current;
    closing.current = false;
    move(origin(photo.ratio), destination(photo.ratio));
    node.focus({ preventScroll: true });
    const outside = event => {
      if (!frame.current?.contains(event.target) && !node.contains(event.target)) collapse();
    };
    const keyboard = event => {
      if (event.key === 'Tab') {
        // Continue the document's normal tab order from the original control.
        collapse();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        collapse();
      }
    };
    const focus = event => {
      if (!node.contains(event.target) && !frame.current?.contains(event.target)) collapse(false);
    };
    const resize = () => {
      if (closing.current) return;
      animation.current?.cancel();
      animation.current = null;
      const box = destination(photo.ratio);
      Object.assign(node.style, { left: `${box.left}px`, top: `${box.top}px`,
        width: `${box.width}px`, height: `${box.height}px` });
    };
    const stopMotion = () => {
      if (document.documentElement.dataset.effects === 'off' || motion.matches) animation.current?.finish();
    };
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const observer = new MutationObserver(stopMotion);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-effects'] });
    motion.addEventListener('change', stopMotion);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    document.addEventListener('focusin', focus);
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', stopMotion);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
      document.removeEventListener('focusin', focus);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      animation.current?.cancel();
    };
  }, [photo]);

  return <>
    <div ref={frame} className={`mugshot-photo-frame${photo ? ' mugshot-photo-expanded' : ''}`}>
      <Portrait src={src} alt={alt} className="mugshot-detail-photo"
        onLoad={() => setReady(true)}
        onError={() => {
          request.current++;
          animation.current?.cancel();
          setPhoto(null);
          setPending(false);
          setReady(false);
        }} />
      <button ref={trigger} type="button" className="mugshot-photo-toggle"
        disabled={!ready} aria-expanded={Boolean(photo)}
        aria-busy={pending || undefined}
        aria-label={`${photo ? 'Collapse' : 'Enlarge'} photograph: ${alt}`}
        onClick={expand} />
    </div>
    {photo && createPortal(
      <button ref={floating} type="button" className="mugshot-photo-floating"
        aria-expanded="true" aria-label={`Collapse photograph: ${alt}`}
        onClick={() => collapse()}>
        <img src={src} alt={alt} onError={() => {
          animation.current?.cancel();
          setPhoto(null);
          setReady(false);
        }} />
      </button>, document.body)}
  </>;
}
