import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const RadioDockVisibilityContext = createContext(null);

export function RadioDockVisibilityProvider({ children }) {
  const { pathname } = useLocation();
  const [inline, setInline] = useState(null);
  const path = pathname.replace(/\/+$/, '') || '/';
  const hidden = path === '/free-santa-message' || path === '/santa-message-workshop'
    || (path === '/' && inline?.pathname === pathname && inline.active);
  return <RadioDockVisibilityContext.Provider value={{ hidden: Boolean(hidden), setInline, pathname }}>
    {children}
  </RadioDockVisibilityContext.Provider>;
}

export function useRadioDockHidden() {
  return useContext(RadioDockVisibilityContext)?.hidden || false;
}

// Measure the actual card, not its much taller promotional section. Pixel
// thresholds work for cards taller than a phone (including its open keyboard).
export function useInlineMakerRadioVisibility() {
  const context = useContext(RadioDockVisibilityContext);
  const setInline = context?.setInline;
  const pathname = context?.pathname;
  const panelRef = useRef(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !setInline || pathname !== '/') return;
    let frame;
    let substantiallyVisible = false;
    let disposed = false;
    const measure = () => {
      frame = undefined;
      if (disposed) return;
      const rect = panel.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = Math.max(viewport?.offsetTop || 0,
        document.querySelector('.navbar')?.getBoundingClientRect().bottom || 0);
      const bottom = (viewport?.offsetTop || 0) + (viewport?.height || innerHeight);
      const available = Math.max(0, bottom - top);
      const visible = Math.max(0, Math.min(rect.bottom, bottom) - Math.max(rect.top, top));
      const enter = Math.min(180, available * .4, rect.height * .4);
      const leave = Math.min(64, available * .15, rect.height * .15);
      substantiallyVisible = rect.width > 0 && rect.height > 0 && available > 0 && visible > 0
        && visible >= (substantiallyVisible ? leave : enter);
      const active = substantiallyVisible || panel.contains(document.activeElement);
      setInline(previous => previous?.active === active && previous.pathname === pathname
        ? previous : { pathname, active });
    };
    const schedule = () => { if (frame === undefined) frame = requestAnimationFrame(measure); };
    // Focus is synchronous so typing never waits for an observer notification.
    const focus = () => { cancelAnimationFrame(frame); measure(); };
    const resize = new ResizeObserver(schedule);
    resize.observe(panel);
    const intersection = new IntersectionObserver(schedule, { threshold: [0, .1, .25, .5, 1] });
    intersection.observe(panel);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', schedule);
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', schedule);
      setInline(null);
    };
  }, [pathname, setInline]);
  return panelRef;
}
