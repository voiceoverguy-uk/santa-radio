import postcards from '../data/deliveryPostcards.json';
import itinerary from '../data/santaItinerary.json';
import { getCurrentStop, getChristmasEveYear } from './santaRoute';
import { getStopDepartureDate } from '../data/santaRouteStops';

/** Geographic jokes only appear during the matching stop's delivery window. */
export function getDeliveryPostcards(now: Date) {
  const stop = getCurrentStop(now);
  const place = stop && now < getStopDepartureDate(stop, getChristmasEveYear(now))
    ? itinerary.find(p => p.id === stop.id) : undefined;
  const general = postcards.filter(p => !p.countryCode && !p.region).map(p => p.message);
  if (!place) return { key: 'transit', messages: general };
  const local = postcards.filter(p => p.countryCode === place.countryCode || p.region === place.mapRegion).map(p => p.message);
  // Alternate local colour with general delivery antics, retaining every eligible line.
  const messages: string[] = [];
  for (let i = 0; i < Math.max(local.length, general.length); i++) {
    if (local[i]) messages.push(local[i]);
    if (general[i]) messages.push(general[i]);
  }
  return { key: `${place.countryCode}:${place.mapRegion}`, messages };
}
