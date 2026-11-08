import itinerary from "./santaItinerary.json";

export interface SantaStop {
  id: string;
  name: string;
  region: string;
  mapRegion?: string;
  flag: string;
  utcOffset: number;
  timeZone?: string;
  lat: number;
  lng: number;
  dwellMinutes: number;
  funFact: string;
  activity: string;
  milestoneType: "start" | "major" | "uk" | "end";
  displayLabel: string;
}

export const TRACKER_CONSTANTS = {
  totalEstimatedGifts: 2_500_000_000,
  totalEstimatedDistanceKm: 510_000_000,
  ukSpecialWindowHours: 2,
  defaultDwellMinutes: 2,
  defaultDwellFraction: 0.6,
  journeyStartUtcHour: 10,
  journeyEndUtcHour: 35 + 20 / 60,
} as const;

// Fictional Santa antics, not claims about local people or Christmas customs.
const antics = [
  "Santa is straightening the gift bows. One has attached itself to his beard.",
  "Santa is checking the next sack. The teddy bears have formed an orderly queue.",
  "Santa is delivering quietly. His boots have not received the instruction.",
  "Santa is consulting the route book. A biscuit crumb is marking the page.",
  "Santa is counting parcels twice. Rudolph keeps joining in at the wrong number.",
  "Santa is checking the toy batteries. One robot has started organising the sleigh.",
  "Santa is untangling a ribbon. The elves describe this as advanced navigation.",
  "Santa is securing the bells. A loose jingle is hiding in his pocket.",
  "Santa is checking every gift tag. His glasses are exactly where he left them.",
  "Santa is adjusting his hat. The pompom is enjoying the view.",
  "Santa is finding room for another present. The sack says he said that last time.",
  "Santa is counting spare mittens. One sock has applied for the job.",
];

export const santaStops: SantaStop[] = itinerary.map((place, index) => ({
  id: place.id,
  name: place.name,
  displayLabel: place.name.split(", ")[0],
  region: place.mapRegion,
  mapRegion: place.mapRegion,
  flag: String.fromCodePoint(...[...place.countryCode].map(char => char.charCodeAt(0) + 127397)),
  lat: place.lat,
  lng: place.lng,
  timeZone: place.timeZone,
  utcOffset: 0,
  dwellMinutes: 2,
  funFact: `${place.name} is one of the 290 destinations on this estimated itinerary. Its local clock uses the ${place.timeZone} time zone.`,
  activity: antics[index % antics.length],
  milestoneType: place.id === "kiritimati" ? "start" : place.id === "london" ? "uk" : place.id === "honolulu" ? "end" : "major",
}));

const offsetCache = new Map<string, number>();
export function getStopUtcOffset(stop: SantaStop, year = new Date().getUTCFullYear()): number {
  if (!stop.timeZone) return stop.utcOffset;
  const key = `${stop.timeZone}:${year}`;
  if (offsetCache.has(key)) return offsetCache.get(key)!;
  const value = new Intl.DateTimeFormat("en-GB", { timeZone: stop.timeZone, timeZoneName: "shortOffset" })
    .formatToParts(new Date(Date.UTC(year, 11, 25))).find(part => part.type === "timeZoneName")!.value;
  const match = value.match(/^GMT([+-])(\d+)(?::(\d+))?$/);
  if (value !== "GMT" && !match) throw new Error(`Cannot interpret Christmas offset: ${value}`);
  const offset = match ? (Number(match[2]) + Number(match[3] || 0) / 60) * (match[1] === "-" ? -1 : 1) : 0;
  offsetCache.set(key, offset);
  return offset;
}

export interface ScheduledStop { stop: SantaStop; arrival: Date; departure: Date }
const scheduleCache = new Map<number, ScheduledStop[]>();
function distance(a: SantaStop, b: SantaStop) {
  const rad = Math.PI / 180;
  return 1 - (Math.sin(a.lat * rad) * Math.sin(b.lat * rad) +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((a.lng - b.lng) * rad));
}

// Time zones are factual; this sequence and all arrival times are fictional estimates.
// Each band begins at local Christmas midnight. Destinations within that band
// receive separate slots before the next band, grouped geographically to limit zigzags.
export function getScheduledStops(year: number): ScheduledStop[] {
  if (scheduleCache.has(year)) return scheduleCache.get(year)!;
  const bands = new Map<number, SantaStop[]>();
  for (const stop of santaStops) {
    const offset = getStopUtcOffset(stop, year);
    bands.set(offset, [...(bands.get(offset) || []), stop]);
  }
  const offsets = [...bands.keys()].sort((a, b) => b - a);
  const schedule: ScheduledStop[] = [];
  let previous = santaStops.find(stop => stop.id === "kiritimati")!;
  offsets.forEach((offset, bandIndex) => {
    const remaining = [...bands.get(offset)!];
    const ordered: SantaStop[] = [];
    while (remaining.length) {
      const anchor = ordered.length === 0 && offset === 0 ? remaining.find(stop => stop.id === "london") : undefined;
      const sameRegion = remaining.filter(stop => stop.mapRegion === previous.mapRegion);
      const candidates = sameRegion.length ? sameRegion : remaining;
      const next = anchor || candidates.reduce((best, stop) => distance(previous, stop) < distance(previous, best) ? stop : best);
      ordered.push(next);
      previous = next;
      remaining.splice(remaining.indexOf(next), 1);
    }
    const baseHour = 24 - offset;
    const nextHour = bandIndex + 1 < offsets.length ? 24 - offsets[bandIndex + 1] : TRACKER_CONSTANTS.journeyEndUtcHour;
    const slotMs = Math.min(1, nextHour - baseHour) * 3600000 / ordered.length;
    ordered.forEach((stop, index) => {
      const ms = Date.UTC(year, 11, 24) + baseHour * 3600000 + Math.round(index * slotMs);
      schedule.push({ stop, arrival: new Date(ms), departure: new Date(ms + Math.min(8 * 60000, slotMs * 0.6)) });
    });
  });
  scheduleCache.set(year, schedule);
  return schedule;
}

export function getStopArrivalDate(stop: SantaStop, year: number): Date {
  return getScheduledStops(year).find(entry => entry.stop.id === stop.id)?.arrival ??
    new Date(Date.UTC(year, 11, 24) + (24 - getStopUtcOffset(stop, year)) * 3600000);
}
export function getStopDepartureDate(stop: SantaStop, year: number): Date {
  return getScheduledStops(year).find(entry => entry.stop.id === stop.id)?.departure ??
    new Date(getStopArrivalDate(stop, year).getTime() + stop.dwellMinutes * 60000);
}
export function getStopArrivalUtcHour(stop: SantaStop, year = new Date().getUTCFullYear()): number {
  return (getStopArrivalDate(stop, year).getTime() - Date.UTC(year, 11, 24)) / 3600000;
}
export function formatStopOffset(stop: SantaStop, year: number): string {
  const offset = getStopUtcOffset(stop, year);
  const minutes = Math.round(Math.abs(offset) * 60);
  return `UTC${offset >= 0 ? "+" : "−"}${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
export function formatStopArrival(stop: SantaStop, year: number): string {
  const date = getStopArrivalDate(stop, year);
  return `${date.getUTCDate()} Dec · ${date.toISOString().slice(11, 19)} UTC`;
}
for (const stop of santaStops) stop.utcOffset = getStopUtcOffset(stop);
// Preserve a stable public route order and make completion resolve to Honolulu.
const initialOrder = getScheduledStops(new Date().getUTCFullYear()).map(entry => entry.stop);
santaStops.splice(0, santaStops.length, ...initialOrder);
