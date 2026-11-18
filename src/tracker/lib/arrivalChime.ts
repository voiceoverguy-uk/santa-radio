import { getChristmasEveYear, getCurrentStopId, getSeasonalTrackerMode } from "./santaRoute";
import { getNewYearCity, isNewYearCelebration } from "./postChristmas";

export interface ArrivalSample { time: number; realTime: number; key: string | null; resetKey: number; speed: number }

export function getArrivalKey(date: Date, includeParty: boolean): string | null {
  if (getSeasonalTrackerMode(date) === "LIVE") {
    const id = getCurrentStopId(date);
    return id ? `delivery:${getChristmasEveYear(date)}:${id}` : null;
  }
  if (includeParty && isNewYearCelebration(date)) return `party:${getNewYearCity(date).id}`;
  return null;
}

/** Only a fresh arrival during continuous playback; never replay skipped destinations. */
export function shouldChime(previous: ArrivalSample | null, next: ArrivalSample): boolean {
  if (!previous || !next.key || previous.key === next.key || previous.resetKey !== next.resetKey) return false;
  if (![1, 10].includes(next.speed) || previous.speed !== next.speed) return false;
  const elapsed = next.realTime - previous.realTime;
  const advanced = next.time - previous.time;
  return elapsed > 0 && elapsed < 5000 && advanced > 0 && advanced <= elapsed * next.speed + 1500;
}
