// Shared by standalone page entry, top navigation and the homepage section link.
export function scrollToSantaMessageDesk(targetElement) {
  const layout = document.querySelector('#santa-messages .message-layout');
  const navigation = document.querySelector('.navbar');
  if (!layout || !navigation) return;
  // Once signup is complete, skip the mobile introduction and show the
  // recording card itself. Desktop keeps its existing two-column alignment.
  const recordingCard = window.matchMedia('(max-width: 767px)').matches
    ? document.querySelector('#santa-messages .santa-message-box:not(.message-access-box)')
    : null;
  const target = targetElement || recordingCard || layout;
  const gap = target === recordingCard ? 12 : 24;
  window.scrollTo({
    top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - navigation.getBoundingClientRect().bottom - gap),
    behavior: 'instant',
  });
}

// Mobile keyboards and Safari's browser bars can finish resizing after the
// signup fields disappear. Follow that brief transition, never the user's
// later scrolling or interaction, and leave desktop entry unchanged.
export function settleSantaMessageDeskAfterEntry(targetElement) {
  scrollToSantaMessageDesk(targetElement);
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
        if (!stopped) scrollToSantaMessageDesk(targetElement);
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
