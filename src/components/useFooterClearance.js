import { useEffect, useRef } from 'react';

// Reserve only the space needed by footer text/controls that share the dock's
// horizontal position. Measuring the dock also handles enlarged text and its
// optional upcoming-tracks panel without changing player behaviour.
export default function useFooterClearance(pathname) {
  const ref = useRef(null);

  useEffect(() => {
    const footer = ref.current;
    const dock = footer?.parentElement.querySelector('.radio-dock');
    if (!footer || !dock) return;

    const update = () => {
      if (!footer.getClientRects().length) return;
      const dockBox = dock.getBoundingClientRect();
      const footerBox = footer.getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(footer).paddingBottom);
      const dockInset = window.innerHeight - dockBox.top;
      let inset = 20;
      const boxes = [...footer.querySelectorAll('a, button')].map(el => el.getBoundingClientRect());
      const copyright = footer.querySelector('.footer-copy');
      if (copyright) {
        const range = document.createRange();
        range.selectNodeContents(copyright);
        boxes.push(...range.getClientRects());
      }
      if (dockBox.width && dockBox.height) {
        for (const box of boxes) {
          if (box.right <= dockBox.left || box.left >= dockBox.right) continue;
          const spaceBelow = footerBox.bottom - padding - box.bottom;
          inset = Math.max(inset, Math.ceil(dockInset + 12 - spaceBelow));
        }
      }
      const value = `${inset}px`;
      if (footer.style.getPropertyValue('--footer-bottom-inset') !== value) {
        footer.style.setProperty('--footer-bottom-inset', value);
      }
    };

    const observer = new ResizeObserver(update);
    observer.observe(footer);
    observer.observe(dock);
    window.addEventListener('resize', update);
    document.fonts.addEventListener('loadingdone', update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      document.fonts.removeEventListener('loadingdone', update);
    };
  }, [pathname]);

  return ref;
}
