import { santaStops } from "../data/santaRouteStops";

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

export const partyCaptions = [
  "Santa’s doing the Macarena in {city}. His knees have requested a quieter song.",
  "Santa’s leading a conga line in {city}. Rudolph keeps trying to overtake him.",
  "Santa’s showing off his dance moves in {city}. The elves are pretending they don’t know him.",
  "Santa’s attempting the YMCA in {city}. His beard keeps getting in the way of the Y.",
  "Santa’s on the dance floor in {city}. That gold party hat has a mind of its own.",
  "Santa’s celebrating in {city}. He’s asked the DJ for one more song. Seven times.",
  "Santa’s enjoying his big night out in {city}. Someone’s mistaken his party blower for a tiny trumpet.",
  "Santa’s throwing some shapes in {city}. Head Elf says most of them look like mince pies.",
  "Santa’s having a boogie in {city}. His boots are jingling louder than the music.",
  "Santa’s partying in {city}. He’s just discovered the buffet and promised the dance floor he’ll be right back.",
] as const;

function shuffled<T>(items: readonly T[]): T[] {
  const order = [...items];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
const captionOrder = shuffled(restCaptions);
const preparationOrder = shuffled(preparationCaptions);
const partyOrder = shuffled(partyCaptions);
export function getNewYearCaption(city: string): string {
  return partyOrder[Math.floor(Date.now() / 30000) % partyOrder.length].replace("{city}", city);
}
export function getPreparationCaption(): string {
  return preparationOrder[Math.floor(Date.now() / 30000) % preparationOrder.length];
}

const partyCityIds = [
  "london", "sydney", "newyork", "paris", "berlin", "tokyo", "hongkong",
  "singapore", "bangkok", "dubai", "capetown", "riodejaneiro", "lasvegas",
  "edinburgh", "auckland", "melbourne", "seoul", "amsterdam", "barcelona",
  "rome", "lisbon", "losangeles", "miami", "buenosaires",
];
export const newYearPartyCities = santaStops.filter(stop => partyCityIds.includes(stop.id));
const partyTour = shuffled(newYearPartyCities);

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

/** Hold each city for ten local-clock minutes, continuing the tour through midnight. */
export function getNewYearCity(now: Date) {
  const local = getDeviceDateParts(now);
  const minutes = local.month === 1
    ? 6 * 60 + local.hour * 60 + local.minute
    : (local.hour - 18) * 60 + local.minute;
  return partyTour[Math.floor(Math.max(0, minutes) / 10) % partyTour.length];
}
