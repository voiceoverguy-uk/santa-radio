export function keepCheckerFocusVisible(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.closest('dialog[open]')) return;
  const rect = target.getBoundingClientRect();
  const navBottom = document.querySelector('.navbar')?.getBoundingClientRect().bottom || 100;
  const dockTop = document.querySelector('.radio-dock:not([hidden])')?.getBoundingClientRect().top || innerHeight;
  if (rect.top < navBottom + 12 || rect.bottom > dockTop - 16)
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
}

export function SoundControl({ audio, children }) {
  return <div className={`nn-toolbar${children ? ' nn-toolbar--progress' : ''}`}>
    {children}
    <button type="button" className="nn-sound" aria-pressed={audio.enabled}
      aria-label={`Sound: ${audio.enabled ? 'on' : 'off'}`}
      title={audio.enabled ? 'Mute sound' : 'Turn sound on'} onClick={audio.toggle}>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        {audio.enabled
          ? <path d="M15 8a5 5 0 0 1 0 8m3-11a9 9 0 0 1 0 14" />
          : <path d="m16 9 5 6m0-6-5 6" />}
      </svg>
    </button>
    {audio.error && <p className="nn-error" role="status">{audio.error}</p>}
  </div>;
}
