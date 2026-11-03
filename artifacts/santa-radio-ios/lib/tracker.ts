import { getDashboardData, isHolidaySeason, isDecemberPrep, isChristmasInJuly } from './tracker-source/lib/santaRoute';
import { holidayDestinations } from './tracker-source/data/santaHolidays';

// Ported route/calculations are kept intact. Presentation deliberately omits
// emoji flags and separates fictional Santa activities from Christmas facts.
const clean = (text: string) => text.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
export function trackerSnapshot(now = new Date()) {
  const data = getDashboardData(now);
  const holiday = holidayDestinations[Math.floor(now.getTime() / 86400000) % holidayDestinations.length];
  const onHoliday = data.mode === 'OFF_SEASON' && isHolidaySeason(now);
  const prep = isDecemberPrep(now);
  return {
    phase: onHoliday ? 'HOLIDAY' : prep ? 'PREPARING' : data.mode,
    title: onHoliday ? isChristmasInJuly(now) ? 'Christmas in July' : 'A well-earned holiday' : prep ? 'Back at the North Pole' : clean(data.statusHeadline),
    description: onHoliday ? `${holiday.activity}. A make-believe holiday postcard. Santa returns to the North Pole on 1 December.`
      : prep ? 'Santa is back at the North Pole preparing for Christmas Eve.' : clean(data.statusSubtext),
    location: onHoliday ? `${holiday.name}, ${holiday.country}` : data.currentStopName,
    nextLocation: onHoliday ? 'North Pole · 1 December' : data.nextStopName === '—' ? 'Christmas Eve' : data.nextStopName,
    progress: data.progressPercent / 100,
    localTime: data.localTimeAtStop === '—' ? now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : data.localTimeAtStop,
    tradition: data.mode === 'LIVE' ? data.currentFunFact : null,
    traditionSource: null as string | null,
  };
}
