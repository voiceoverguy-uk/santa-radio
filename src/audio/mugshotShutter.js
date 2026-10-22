// Shared by both card grids: one clip at a time, independent of other site audio.
const SOURCE = '/audio/mugshots/camera.mp3';
const RETRIGGER_DELAY = 500;
let audio;
let activeAttempt;
let lastStarted = -Infinity;
const hoveredCards = new WeakMap();

function playShutter() {
  const now = performance.now();
  if (activeAttempt || now - lastStarted < RETRIGGER_DELAY) return null;

  const attempt = { failed: false };
  const fail = () => {
    attempt.failed = true;
    if (activeAttempt === attempt) {
      activeAttempt = null;
      lastStarted = -Infinity;
    }
  };

  try {
    if (!audio) {
      audio = new Audio(SOURCE);
      audio.preload = 'auto';
    }
    audio.currentTime = 0;
    activeAttempt = attempt;
    lastStarted = now;
    audio.onended = () => {
      if (activeAttempt === attempt) activeAttempt = null;
    };
    audio.onerror = fail;
    // Never await playback or prevent the link's normal navigation.
    const playback = audio.play();
    playback?.catch(fail);
  } catch {
    fail();
  }
  return attempt;
}

export const mugshotShutterEvents = {
  onPointerEnter(event) {
    // Touch generates pointerenter too, but must wait for an intentional tap.
    if (event.pointerType !== 'mouse' || event.buttons !== 0) return;
    const attempt = playShutter();
    if (attempt) hoveredCards.set(event.currentTarget, attempt);
  },
  onPointerLeave(event) {
    hoveredCards.delete(event.currentTarget);
  },
  onClick(event) {
    const hover = hoveredCards.get(event.currentTarget);
    // A successful hover already supplied feedback for this pointer visit,
    // even if the short clip has finished before the user clicks.
    if (event.detail !== 0 && hover && !hover.failed) return;
    playShutter();
  },
};
