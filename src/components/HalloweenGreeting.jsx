import { useEffect, useState } from 'react';

export default function HalloweenGreeting() {
  // The server cannot know the visitor's date. Keep its markup and the first
  // browser render identical, then resolve the local calendar after mounting.
  const [isHalloween, setIsHalloween] = useState(false);

  useEffect(() => {
    let timer;
    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      setIsHalloween(now.getMonth() === 9 && now.getDate() === 31);
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 20);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
    };
  }, []);

  return isHalloween ? <p className="hero-halloween-greeting">Happy Halloween</p> : null;
}
