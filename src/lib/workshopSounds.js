export const WORKSHOP_SOUNDS = Object.freeze({
  tick: '/audio/workshop/click-scroller.mp3',
  next: '/audio/workshop/message-next.mp3',
});

// Deliberate UI feedback only. This controller never discovers, pauses or
// changes the volume of any other site audio, including the radio.
export function createWorkshopSounds({
  createAudio = source => new Audio(source),
  onStatus = () => {},
} = {}) {
  const players = new Map();
  let enabled = true;
  let disposed = false;
  let generation = 0;
  let currentStatus = '';
  const notify = message => {
    if (disposed || currentStatus === message) return;
    currentStatus = message;
    onStatus(message);
  };
  const stop = () => {
    generation++;
    for (const audio of players.values()) {
      try { audio.pause(); audio.currentTime = 0; } catch { /* Unloaded media has nothing to stop. */ }
    }
  };
  const ensurePlayer = kind => {
    if (!players.has(kind)) {
      const audio = createAudio(WORKSHOP_SOUNDS[kind]);
      audio.preload = 'auto';
      audio.volume = 0.55;
      audio.onerror = () => {
        if (enabled) notify('Workshop sounds could not be loaded. You can still use every choice.');
      };
      players.set(kind, audio);
      audio.load();
    }
    return players.get(kind);
  };
  const prepare = () => {
    if (!enabled || disposed) return;
    try { Object.keys(WORKSHOP_SOUNDS).forEach(ensurePlayer); }
    catch { notify('Workshop sounds are unavailable in this browser. Your choices still work.'); }
  };
  const play = kind => {
    if (!enabled || disposed || !(kind in WORKSHOP_SOUNDS)) return;
    try {
      const audio = ensurePlayer(kind);
      stop();
      const token = generation;
      // Invoke play synchronously in the activation handler, not in an effect
      // or after a timer/fetch, so browser gesture permission is preserved.
      const playback = audio.play();
      Promise.resolve(playback).then(() => {
        if (!disposed && enabled && token === generation) notify('');
      }).catch(error => {
        if (disposed || !enabled || token !== generation) return;
        notify(error?.name === 'NotAllowedError'
          ? 'Your browser blocked workshop sounds. You can continue without sound.'
          : 'Workshop sounds could not be played. You can still use every choice.');
      });
    } catch {
      notify('Workshop sounds are unavailable in this browser. Your choices still work.');
    }
  };
  return {
    prepare,
    playTick: () => play('tick'),
    playNext: () => play('next'),
    setEnabled(value) {
      enabled = !!value;
      stop();
      notify('');
      if (enabled) prepare();
    },
    dispose() {
      stop();
      disposed = true;
      for (const audio of players.values()) {
        audio.onerror = null;
        try { audio.removeAttribute('src'); audio.load(); } catch { /* Already disposed. */ }
      }
      players.clear();
    },
  };
}
