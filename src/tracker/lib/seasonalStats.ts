import { getDeviceDateParts } from "./postChristmas";
import { getJourneyEndTime } from "./santaRoute";

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

/** Fixed slots and clock-based totals make refreshes and preview jumps reproducible. */
export function getSeasonalStats(date: Date, phase: "preparation" | "holiday" | "party" | "rest") {
  const local = getDeviceDateParts(date);
  let day = Math.floor(Date.UTC(local.year, local.month - 1, local.day) / 86400000);
  const secondsToday = local.hour * 3600 + local.minute * 60 + date.getSeconds();
  let progress: number;
  if (phase === "party") {
    const celebrationYear = local.month === 1 ? local.year - 1 : local.year;
    day = Math.floor(Date.UTC(celebrationYear, 11, 31) / 86400000);
    const elapsed = local.month === 1 ? secondsToday + 6 * 3600 : secondsToday - 18 * 3600;
    progress = elapsed / (9 * 3600);
  } else {
    // Small activities finish occasionally during Santa's waking day, rather than racing upwards.
    let start = (phase === "holiday" ? 8 : 7) * 3600;
    if (phase === "rest" && local.month === 12) {
      const midnight = new Date(local.year, local.month - 1, local.day).getTime();
      const tomorrow = new Date(local.year, local.month - 1, local.day + 1).getTime();
      const finished = getJourneyEndTime(local.year).getTime();
      if (finished >= midnight && finished < tomorrow) start = Math.max(start, (finished - midnight) / 1000);
    }
    const end = 22 * 3600;
    progress = start >= end ? 0 : (secondsToday - start) / (end - start);
  }
  progress = Math.max(0, Math.min(1, progress));
  return metrics[phase].map((metric, index) => {
    const seed = (Math.imul(day, 1664525) + (index + 1) * 1013904223) >>> 0;
    const dailyTotal = metric.min + seed % (metric.max - metric.min + 1);
    return {
      key: metric.key,
      label: metric.label,
      count: metric.key === "names" ? dailyTotal + secondsToday * 2 : Math.round(dailyTotal * progress),
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
