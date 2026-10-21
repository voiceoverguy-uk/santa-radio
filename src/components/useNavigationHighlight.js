import { useEffect, useRef, useState } from 'react';

// The decoration never owns current-page semantics or handles activation.
export default function useNavigationHighlight(routeKey) {
  const menuRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [focused, setFocused] = useState(null);
  const [geometry, setGeometry] = useState(null);
  const target = hovered || focused;

  useEffect(() => {
    setHovered(null);
    setFocused(null);
  }, [routeKey]);

  useEffect(() => {
    const menu = menuRef.current;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      // Use the actual container-query layout, not a duplicate JS breakpoint.
      if (getComputedStyle(menu).flexDirection !== 'row' || !menu.getClientRects().length) {
        setHovered(null);
        setFocused(null);
        setGeometry(null);
        return;
      }
      const control = (target && menu.querySelector(`[data-nav-key="${target}"]`)?.querySelector('a, button')) ||
        menu.querySelector('[aria-current="page"]');
      if (!control) {
        setGeometry(null);
        return;
      }
      const bounds = control.getBoundingClientRect();
      const origin = menu.getBoundingClientRect();
      const inset = control.classList.contains('nav-message') ? 18 : 0;
      const next = {
        x: bounds.left - origin.left + inset,
        y: bounds.bottom - origin.top + (inset ? -8 : 4),
        width: bounds.width - inset * 2,
      };
      setGeometry(previous => previous && Object.keys(next).every(key => previous[key] === next[key]) ? previous : next);
    };
    measure();
    // Every control is observed: changing the radio label moves its neighbours.
    const observer = new ResizeObserver(measure);
    observer.observe(menu);
    menu.querySelectorAll('a, button').forEach(control => observer.observe(control));
    window.addEventListener('resize', measure);
    document.fonts?.addEventListener('loadingdone', measure);
    document.fonts?.ready.then(measure);
    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('resize', measure);
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, [target, routeKey]);

  const desktop = () => getComputedStyle(menuRef.current).flexDirection === 'row';
  const keyOf = element => element.closest('[data-nav-key]')?.dataset.navKey || null;
  return {
    menuRef,
    target,
    style: geometry ? {
      '--nav-highlight-x': `${geometry.x}px`,
      '--nav-highlight-y': `${geometry.y}px`,
      '--nav-highlight-width': `${geometry.width}px`,
      '--nav-highlight-opacity': 1,
    } : undefined,
    handlers: {
      onPointerMove: event => {
        if (event.pointerType === 'mouse' && desktop()) setHovered(keyOf(event.target));
      },
      onPointerLeave: () => setHovered(null),
      onFocus: event => {
        if (desktop() && event.target.matches(':focus-visible')) setFocused(keyOf(event.target));
      },
      onBlur: () => setFocused(null),
      onKeyDown: event => {
        setHovered(null);
        if (desktop()) setFocused(keyOf(event.target));
      },
    },
  };
}
