import { useState } from 'react';

function CornerArtwork({ src, width, height, fallback }) {
  const [failed, setFailed] = useState(false);
  return <>
    {!failed && <img src={src} width={width} height={height} alt="" onError={() => setFailed(true)} />}
    <span className={`nn-corner-fallback${failed ? ' is-visible' : ''}`}>{fallback}</span>
  </>;
}

function SoundArtworkButton({ audio }) {
  return <button type="button" className="nn-corner-button" aria-pressed={audio.enabled}
    aria-label={`Sound: ${audio.enabled ? 'on' : 'off'}`}
    title={audio.enabled ? 'Mute sound' : 'Turn sound on'} onClick={audio.toggle}>
    <CornerArtwork key={String(audio.enabled)}
      src={`/images/checker-Music${audio.enabled ? 'On' : 'Off'}.webp`}
      width="192" height="192" fallback={`Sound ${audio.enabled ? 'on' : 'off'}`} />
  </button>;
}

export function HomepageCornerControls({ audio, onRestart, showRestart = true }) {
  return <>
    <div className={`nn-corner-controls${showRestart ? '' : ' nn-corner-controls--sound-only'}`}>
      {showRestart && <button type="button" className="nn-corner-button" aria-label="Start a new name check"
        title="Start a new name check" onClick={onRestart}>
        <CornerArtwork src="/images/checker-home.webp" width="192" height="192" fallback="Start again" />
      </button>}
      <SoundArtworkButton audio={audio} />
    </div>
    {audio.error && <p className="nn-error" role="status">{audio.error}</p>}
  </>;
}

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

export function SoundControl({ audio }) {
  return <>
    <div className="nn-corner-controls nn-corner-controls--sound-only">
      <SoundArtworkButton audio={audio} />
    </div>
    {audio.error && <p className="nn-error" role="status">{audio.error}</p>}
  </>;
}
