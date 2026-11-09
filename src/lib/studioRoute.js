// Private Studio addresses are deliberately separate from public SEO aliases.
export const STUDIO_PATH = '/bespoke-personalised-message-from-santa';
export const STUDIO_ALIASES = ['/santa-message-workshop', '/bespoke-pesonalised-message-from-santa'];
export function isStudioPath(pathname) {
  const path = pathname.replace(/\/+$/, '');
  return path === STUDIO_PATH || STUDIO_ALIASES.includes(path);
}
