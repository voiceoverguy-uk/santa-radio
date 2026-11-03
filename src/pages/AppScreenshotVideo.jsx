import { useEffect, useRef } from 'react';

// Mounted only for the active, motion-enabled item. Leaving the item discards
// the decoder so every later visit starts at the beginning.
export default function AppScreenshotVideo({ slide, playing, onComplete, onFailure }) {
  const videoRef = useRef(null);
  const wantsPlayback = useRef(playing);
  wantsPlayback.current = playing;

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;
    let watchdog;
    let lastTime = video.currentTime;
    const failed = () => { if (!cancelled) onFailure(); };
    const armWatchdog = () => {
      clearTimeout(watchdog);
      if (playing) watchdog = setTimeout(failed, 12000);
    };
    const progress = () => {
      if (video.currentTime <= lastTime) return;
      lastTime = video.currentTime;
      armWatchdog();
    };
    video.defaultMuted = true;
    video.muted = true;
    if (playing) {
      armWatchdog();
      try {
        video.play()?.then(() => {
          // An older attempt may settle after a newer Resume on the same
          // element. Do not pause that newer, valid playback.
          if (!wantsPlayback.current || videoRef.current !== video) video.pause();
        }).catch(error => {
          if (error?.name !== 'AbortError') failed();
        });
      } catch { failed(); }
    } else video.pause();
    video.addEventListener('timeupdate', progress);
    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      video.removeEventListener('timeupdate', progress);
      video.pause();
    };
  }, [playing, onFailure]);

  return <video ref={videoRef} src={slide.video} poster={slide.image}
    className="app-screenshot-video" width={slide.width} height={slide.height}
    muted playsInline preload="none" aria-label={slide.alt}
    onEnded={onComplete} onError={onFailure}
    onPlaying={event => { if (!wantsPlayback.current) event.currentTarget.pause(); }} />;
}
