const metrics = {
  preparation: [
    { key: "towns", label: "Towns explored today", min: 4, max: 12, note: "Only got lost twice." },
    { key: "chimneys", label: "Chimneys inspected", min: 18, max: 72, note: "One was a tight squeeze." },
    { key: "cocoa", label: "Cocoa stops today", min: 3, max: 9, note: "Purely for research." },
    { key: "names", label: "Names checked twice", min: 804, max: 6408, note: "And counting." },
  ],
  holiday: [
    { key: "coladas", label: "Piña coladas sipped", min: 1, max: 4, note: "Keeping the tiny umbrellas." },
    { key: "sandcastles", label: "Sandcastles built", min: 2, max: 8, note: "All look like the North Pole." },
    { key: "postcards", label: "Postcards sent", min: 3, max: 16, note: "Wish you were ho-ho-here." },
    { key: "icecreams", label: "Ice creams sampled", min: 2, max: 7, note: "Important flavour research." },
  ],
} as const;

/** A shared UTC-day seed keeps the playful totals consistent across refreshes and destinations. */
export function getSeasonalStats(date: Date, phase: "preparation" | "holiday", rotationTimeMs = Date.now()) {
  const day = Math.floor(date.getTime() / 86400000);
  const stats = metrics[phase].map((metric, index) => {
    const seed = (Math.imul(day, 1664525) + (index + 1) * 1013904223) >>> 0;
    return {
      key: metric.key,
      label: metric.label,
      count: metric.min + seed % (metric.max - metric.min + 1),
      note: metric.note,
    };
  });
  return Math.floor(rotationTimeMs / 60000) % 2 === 0
    ? stats
    : [...stats.slice(2), ...stats.slice(0, 2)];
}
