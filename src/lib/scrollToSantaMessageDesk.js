// Shared by standalone page entry, top navigation and the homepage section link.
export function scrollToSantaMessageDesk() {
  const layout = document.querySelector('#santa-messages .message-layout');
  const navigation = document.querySelector('.navbar');
  if (!layout || !navigation) return;
  window.scrollTo({
    top: window.scrollY + layout.getBoundingClientRect().top - navigation.getBoundingClientRect().bottom - 24,
    behavior: 'instant',
  });
}
