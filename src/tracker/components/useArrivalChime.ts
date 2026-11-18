import { useEffect, useRef, useState } from "react";
import { getArrivalKey, shouldChime, type ArrivalSample } from "../lib/arrivalChime";

export default function useArrivalChime(date: Date, speed: number, resetKey: number) {
  const [enabled, setEnabled] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const previous = useRef<ArrivalSample | null>(null);
  const lastPlayed = useRef(0);

  useEffect(() => {
    const sample = { time: date.getTime(), realTime: Date.now(), key: getArrivalKey(date), resetKey, speed };
    if (![1, 10].includes(speed)) audio.current?.pause();
    const arrival = shouldChime(previous.current, sample);
    previous.current = sample;
    if (!enabled || !arrival || !audio.current || sample.realTime - lastPlayed.current < 2500) return;
    lastPlayed.current = sample.realTime;
    audio.current.currentTime = 0;
    void audio.current.play().catch(() => setEnabled(false));
  }, [date, speed, resetKey, enabled]);

  useEffect(() => () => { audio.current?.pause(); }, []);

  const toggle = () => {
    if (enabled) {
      audio.current?.pause();
      setEnabled(false);
      return;
    }
    // This explicit click also unlocks playback in browsers that require a gesture.
    if (!audio.current) audio.current = new Audio("/audio/tracker/arrived.mp3");
    audio.current.volume = 0.45;
    audio.current.currentTime = 0;
    lastPlayed.current = Date.now();
    setEnabled(true);
    void audio.current.play().catch(() => setEnabled(false));
  };
  return { enabled, toggle };
}
