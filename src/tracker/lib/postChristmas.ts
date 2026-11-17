import { santaStops, type SantaStop } from "../data/santaRouteStops";

export const restCaptions = [
  "Santa’s resting in his North Pole grotto with his slippers on and a lovely mug of cocoa.",
  "A well-earned snooze at the grotto. Even Santa needs a rest after Christmas Eve!",
  "Santa’s putting his feet up by the grotto fire while the reindeer enjoy a quiet day too.",
  "The sleigh is parked and Santa’s tucked up at the North Pole, catching up on sleep.",
  "Santa’s enjoying a peaceful day at his grotto. The only thing on his list is taking it easy.",
  "A cosy blanket, a comfy chair and another mince pie. Santa’s recharging at the North Pole.",
  "Santa’s having a quiet rest in his grotto. The elves have put a ‘Do Not Disturb’ sign on the door.",
  "There’s no rushing today. Santa’s relaxing at the grotto with a favourite book and warm socks.",
  "Santa’s taking a little nap at the North Pole. His hat is resting on the chair beside him.",
  "Time for a breather! Santa’s enjoying the peace and quiet of his North Pole grotto.",
] as const;

export const preparationCaptions = [
  "Santa’s getting ready at the North Pole, checking his list one last time before takeoff!",
  "The red suit is on! Santa’s at the North Pole, making sure every pocket has a spare mince pie.",
  "Santa’s getting ready at the grotto while the elves finish loading the sleigh.",
  "Nearly time to go! Santa’s checking the sleigh bells and giving Rudolph a cheerful pat.",
  "Santa’s at the North Pole, polishing his boots and getting ready for the big journey.",
  "One last look at the route! Santa’s getting ready with his map and a warm mug of cocoa.",
  "Santa’s checking the gift sacks at the North Pole. The teddy bears are all ready to travel!",
  "The reindeer are ready and Santa’s straightening his hat. Takeoff is getting closer!",
  "Santa’s getting ready at the North Pole. Head Elf is helping him check that nothing’s been left behind.",
  "A final wave to the workshop team! Santa’s at the North Pole, getting ready to climb into his sleigh.",
] as const;

function shuffledCaptions(captions: readonly string[]): string[] {
  const order = [...captions];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
const captionOrder = shuffledCaptions(restCaptions);
const preparationOrder = shuffledCaptions(preparationCaptions);
export function getPreparationCaption(): string {
  return preparationOrder[Math.floor(Date.now() / 30000) % preparationOrder.length];
}

// Additional inhabited offsets absent from the delivery itinerary.
// Coordinates and IANA zone identifiers follow the system IANA zone.tab catalogue.
const additionalCities: SantaStop[] = [
  ["Pago Pago", "Pacific/Pago_Pago", -14.2667, -170.7],
  ["Eucla", "Australia/Eucla", -31.7167, 128.8667],
  ["Nuuk", "America/Nuuk", 64.1833, -51.7333],
  ["St John’s", "America/St_Johns", 47.5667, -52.7167],
  ["Yangon", "Asia/Yangon", 16.7833, 96.1667],
  ["Praia", "Atlantic/Cape_Verde", 14.9167, -23.5167],
  ["Chatham Islands", "Pacific/Chatham", -43.95, -176.55],
  ["Marquesas Islands", "Pacific/Marquesas", -9, -139.5],
].map(([name, timeZone, lat, lng]) => ({
  ...santaStops[0], id: String(timeZone), name: String(name), displayLabel: String(name),
  timeZone: String(timeZone), lat: Number(lat), lng: Number(lng),
  flag: "🎉", region: String(timeZone).split("/")[0],
}));
const celebrationDestinations = [...santaStops, ...additionalCities];

const celebrationCities = new Map<string, SantaStop>();

export function getRestCaption(): string {
  return captionOrder[Math.floor(Date.now() / 30000) % captionOrder.length];
}

export function getDeviceDateParts(now: Date, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

export function isNewYearCelebration(now: Date): boolean {
  const local = getDeviceDateParts(now);
  return (local.month === 12 && local.day === 31 && local.hour >= 18)
    || (local.month === 1 && local.day === 1 && local.hour < 3);
}

/** Prefer the device's IANA zone, then cities sharing its local date and clock. */
export function getNewYearCity(now: Date): SantaStop {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const local = getDeviceDateParts(now, zone);
  const celebrationYear = local.month === 1 ? local.year - 1 : local.year;
  const key = `${zone}:${celebrationYear}`;
  const existing = celebrationCities.get(key);
  if (existing) return existing;
  let cities = celebrationDestinations.filter(stop => stop.timeZone === zone);
  if (cities.length === 0) {
    cities = celebrationDestinations.filter(stop => {
      const city = getDeviceDateParts(now, stop.timeZone ?? "UTC");
      return city.year === local.year && city.month === local.month && city.day === local.day
        && city.hour === local.hour && city.minute === local.minute;
    });
  }
  // Include the fractional-hour offsets when choosing a celebration destination.
  // A repeatable annual draw keeps Santa in the same city after a reload.
  let seed = 0;
  for (const character of key) seed = (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0;
  const city = cities[seed % cities.length];
  if (!city) throw new Error(`No New Year city matches device timezone ${zone}`);
  celebrationCities.set(key, city);
  return city;
}
