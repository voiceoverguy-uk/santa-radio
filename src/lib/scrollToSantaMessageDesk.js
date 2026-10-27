// Shared by standalone page entry, top navigation and the homepage section link.
export function scrollToSantaMessageDesk() {
  const layout = document.querySelector('#santa-messages .message-layout');
  const navigation = document.querySelector('.navbar');
  if (!layout || !navigation) return;
  window.scrollTo({
    top: Math.max(0, window.scrollY + layout.getBoundingClientRect().top - navigation.getBoundingClientRect().bottom - 24),
    behavior: 'instant',
  });
}

// Mobile keyboards and Safari's browser bars can finish resizing after the
// signup fields disappear. Follow that brief transition, never the user's
// later scrolling or interaction, and leave desktop entry unchanged.
export function settleSantaMessageDeskAfterEntry() {
  scrollToSantaMessageDesk();
  if (!window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches) return () => {};

  const viewport = window.visualViewport;
  const interactions = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
  let stopped = false;
  let correction;
  let expiry;
  let frame;
  const stop = () => {
    stopped = true;
    clearTimeout(correction);
    clearTimeout(expiry);
    cancelAnimationFrame(frame);
    viewport?.removeEventListener('resize', schedule);
    window.removeEventListener('resize', schedule);
    interactions.forEach(event => window.removeEventListener(event, stop));
  };
  const schedule = () => {
    clearTimeout(correction);
    correction = setTimeout(() => {
      frame = requestAnimationFrame(() => {
        if (!stopped) scrollToSantaMessageDesk();
      });
    }, 140);
  };
  viewport?.addEventListener('resize', schedule);
  window.addEventListener('resize', schedule);
  interactions.forEach(event => window.addEventListener(event, stop, { passive: true }));
  schedule();
  expiry = setTimeout(stop, 1800);
  return stop;
}
