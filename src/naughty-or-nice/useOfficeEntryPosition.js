import { useEffect } from 'react';

// Open on the working part of the office, not the scenery above it. This is
// initial entry only: later focus/scrolling and quiz stages remain independent.
export default function useOfficeEntryPosition(entry) {
  useEffect(() => {
    const scene = entry.current?.closest('.nn-scene');
    const panel = entry.current?.closest('.nn-panel');
    const navigation = document.querySelector('.navbar');
    if (!scene || !panel || !navigation) return;
    let active = true;
    let frame;
    let expiry;
    const observer = new ResizeObserver(schedule);
    const interactions = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    function position() {
      if (!active) return;
      const panelBox = panel.getBoundingClientRect();
      const titleBox = scene.querySelector('.nn-office-scene-heading .nn-heading')?.getBoundingClientRect();
      const targetTop = Math.min(panelBox.top, titleBox?.top ?? panelBox.top);
      const targetBottom = Math.max(panelBox.bottom, titleBox?.bottom ?? panelBox.bottom);
      const top = navigation.getBoundingClientRect().bottom + 16;
      const dock = document.querySelector('.radio-dock:not([hidden])')?.getBoundingClientRect();
      const bottom = Math.max(top + 100, Math.min(innerHeight - 16, dock?.height ? dock.top - 16 : innerHeight - 16));
      // Centre when it fits; on small screens begin at the title/elf instead
      // of clipping the top or shrinking the text to fit the viewport.
      const gap = Math.max(0, (bottom - top - (targetBottom - targetTop)) / 2);
      const delta = targetTop - top - gap;
      if (Math.abs(delta) > 1)
        window.scrollTo({ top: Math.max(0, scrollY + delta), behavior: 'instant' });
    }
    function schedule() {
      if (!active) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(position);
    }
    function stop() {
      active = false;
      cancelAnimationFrame(frame);
      clearTimeout(expiry);
      observer.disconnect();
      window.removeEventListener('load', schedule);
      window.removeEventListener('resize', schedule);
      document.fonts.removeEventListener('loadingdone', schedule);
      interactions.forEach(event => window.removeEventListener(event, stop));
    }
    observer.observe(scene);
    observer.observe(panel);
    observer.observe(navigation);
    const title = scene.querySelector('.nn-office-scene-heading');
    if (title) observer.observe(title);
    const dock = document.querySelector('.radio-dock');
    if (dock) observer.observe(dock);
    window.addEventListener('load', schedule);
    window.addEventListener('resize', schedule);
    document.fonts.addEventListener('loadingdone', schedule);
    interactions.forEach(event => window.addEventListener(event, stop, { passive: true }));
    document.fonts.ready.then(schedule);
    schedule();
    expiry = setTimeout(stop, 3000);
    return stop;
  }, [entry]);
}
