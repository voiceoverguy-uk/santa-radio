import { getSeasonalTrackerMode } from './santaRoute';
import { getDeviceDateParts, isNewYearCelebration } from './postChristmas';

/** Use the same delivery window and local New Year clock as the map. */
export function getPostcardSeason(now: Date) {
  const mode = getSeasonalTrackerMode(now);
  if (mode === 'LIVE') return 'delivery';
  if (mode === 'PREPARING') return 'workshop';
  if (isNewYearCelebration(now)) return 'party';
  const local = getDeviceDateParts(now);
  if (local.month === 1 && local.day === 1) return 'recovery';
  if (mode === 'COMPLETE') return 'rest';
  if (mode === 'ROUTE_RESEARCH') return 'planning';
  return 'holiday';
}
