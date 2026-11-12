// Browser timers overflow beyond 2^31-1 ms. Recheck long sessions in safe chunks.
export function scheduleExpiry(expiresAt, onExpire, { now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer, cancelled = false;
  function check() {
    if (cancelled) return;
    const remaining = expiresAt - now();
    if (remaining <= 0) { onExpire(); return; }
    timer = setTimer(check, Math.min(remaining, 2147483647));
  }
  check();
  return () => { cancelled = true; clearTimer(timer); };
}
