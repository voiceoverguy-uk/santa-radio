import { getDeviceDateParts } from "./postChristmas";

const metrics = {
  preparation: [
    { key: "towns", label: "Towns explored today", min: 4, max: 12, note: "Only got lost twice." },
    { key: "chimneys", label: "Chimneys inspected", min: 18, max: 72, note: "One was a tight squeeze." },
    { key: "cocoa", label: "Cocoa stops today", min: 3, max: 9, note: "Purely for research." },
    { key: "names", label: "Names checked twice", min: 804, max: 6408, note: "And counting." },
  ],
  rest: [
    { key: "thanks", label: "Thank-you cards read", min: 24, max: 180, note: "Every one gets a smile." },
    { key: "specials", label: "Christmas specials watched", min: 1, max: 5, note: "He knows all the lines." },
    { key: "naps", label: "Naps taken", min: 2, max: 6, note: "Just resting his eyes." },
    { key: "biscuits", label: "Biscuits dunked", min: 4, max: 14, note: "One didn’t make it." },
  ],
  party: [
    { key: "autographs", label: "Autographs signed", min: 18, max: 84, note: "Mostly on napkins." },
    { key: "dance", label: "Dance moves completed", min: 24, max: 128, note: "The Macarena counts as eight." },
    { key: "selfies", label: "Selfies posed for", min: 12, max: 96, note: "Someone always blinks." },
    { key: "snacks", label: "Party snacks sampled", min: 8, max: 28, note: "The buffet is under close supervision." },
  ],
  holiday: [
    { key: "coladas", label: "Piña coladas sipped", min: 1, max: 4, note: "Keeping the tiny umbrellas." },
    { key: "sandcastles", label: "Sandcastles built", min: 2, max: 8, note: "All look like the North Pole." },
    { key: "postcards", label: "Postcards sent", min: 3, max: 16, note: "Wish you were ho-ho-here." },
    { key: "icecreams", label: "Ice creams sampled", min: 2, max: 7, note: "Important flavour research." },
  ],
} as const;

/** Fixed card slots use deterministic counts. Names advance with time and party totals span midnight. */
export function getSeasonalStats(date: Date, phase: "preparation" | "holiday" | "party" | "rest") {
  let day = Math.floor(date.getTime() / 86400000);
  if (phase === "party") {
    const local = getDeviceDateParts(date);
    const celebrationYear = local.month === 1 ? local.year - 1 : local.year;
    day = Math.floor(Date.UTC(celebrationYear, 11, 31) / 86400000);
  }
  const secondsToday = Math.floor((date.getTime() - Math.floor(date.getTime() / 86400000) * 86400000) / 1000);
  return metrics[phase].map((metric, index) => {
    const seed = (Math.imul(day, 1664525) + (index + 1) * 1013904223) >>> 0;
    const dailyCount = metric.min + seed % (metric.max - metric.min + 1);
    return {
      key: metric.key,
      label: metric.label,
      count: metric.key === "names" ? dailyCount + secondsToday * 2 : dailyCount,
      note: metric.note,
    };
  });
}


export function getRestDetails(date: Date) {
  const local = getDeviceDateParts(date);
  const rooms = ["Kitchen", "Bathroom", "Shower", "Armchair"];
  const sleeping = local.hour >= 22 || local.hour < 7;
  const day = Math.floor(date.getTime() / 86400000);
  const cocoaSeed = (Math.imul(day, 1664525) + 5 * 1013904223) >>> 0;
  return {
    nextStop: sleeping ? "Bed" : rooms[Math.floor((local.hour * 60 + local.minute) / 10) % rooms.length],
    cocoa: 3 + cocoaSeed % 7,
    clock: `${local.hour % 12 || 12}:${String(local.minute).padStart(2, "0")} ${local.hour >= 12 ? "PM" : "AM"}`,
  };
}
