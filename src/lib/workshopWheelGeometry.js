// Measure on mount/resize, not for every scroll event. Offsets are relative to
// the positioned scroll container and support wrapped, variable-height rows.
export function measureWorkshopWheel(wheel, options, topSpacer, bottomSpacer) {
  const first = options[0], last = options.at(-1);
  if (!wheel || !first || !last) return null;
  const height = wheel.clientHeight;
  const top = `${Math.max(0, (height - first.offsetHeight) / 2)}px`;
  const bottom = `${Math.max(0, (height - last.offsetHeight) / 2)}px`;
  if (topSpacer && topSpacer.style.height !== top) topSpacer.style.height = top;
  if (bottomSpacer && bottomSpacer.style.height !== bottom) bottomSpacer.style.height = bottom;
  return { height, width: wheel.clientWidth, centers: options.map(option => option.offsetTop + option.offsetHeight / 2) };
}

export function sameWheelGeometry(a, b) {
  return !!a && !!b && a.height === b.height && a.width === b.width
    && a.centers.length === b.centers.length && a.centers.every((center, index) => Math.abs(center - b.centers[index]) < .5);
}

export function nearestWheelIndex(geometry, scrollTop) {
  if (!geometry?.centers.length) return -1;
  const { centers, height } = geometry;
  const target = scrollTop + height / 2;
  let low = 0, high = centers.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (centers[middle] < target) low = middle + 1;
    else high = middle;
  }
  return low > 0 && target - centers[low - 1] <= centers[low] - target ? low - 1 : low;
}
