import { useCallback, useEffect, useRef, useState } from 'react';

export default function useSoundboard() {
  const [active, setActive] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const audioRef = useRef(null);

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (!audio) return;
    audio.onended = audio.onerror = audio.onplaying = audio.onwaiting = audio.onstalled = audio.onpause = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }, []);

  const stop = useCallback(() => {
    releaseAudio();
    setActive(null);
    setStatus('idle');
  }, [releaseAudio]);

  useEffect(() => releaseAudio, [releaseAudio]);
  useEffect(() => {
    document.addEventListener('santa-radio:example-start', stop);
    return () => document.removeEventListener('santa-radio:example-start', stop);
  }, [stop]);

  const play = async phrase => {
    const sameClip = audioRef.current?.dataset.clip === phrase.file;
    stop();
    setError('');
    if (sameClip) return;
    document.dispatchEvent(new CustomEvent('santa-radio:soundboard-start'));
    const audio = new Audio(`/audio/soundboard/${phrase.file}.mp3`);
    audio.dataset.clip = phrase.file;
    audioRef.current = audio;
    setActive(phrase.file);
    setStatus('loading');
    const current = () => audioRef.current === audio;
    const finish = () => { if (current()) stop(); };
    const fail = () => {
      if (!current()) return;
      stop();
      setError(`Could not play “${phrase.label}”. Please try again.`);
    };
    audio.onended = audio.onpause = finish;
    audio.onerror = fail;
    audio.onplaying = () => { if (current()) setStatus('playing'); };
    audio.onwaiting = audio.onstalled = () => { if (current()) setStatus('loading'); };
    try {
      await audio.play();
      // A resolved play promise confirms playback has begun. Guard against
      // a superseded recording resolving after a different button was tapped.
      if (current()) setStatus('playing');
    } catch { fail(); }
  };

  return { active, status, error, play, stop };
}
