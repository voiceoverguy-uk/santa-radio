import {
  santaStops,
  TRACKER_CONSTANTS,
  getStopArrivalDate,
  type SantaStop,
} from "@/data/santaRouteStops";
import { holidayDestinations, type HolidayDestination } from "@/data/santaHolidays";

export type SeasonalMode = "OFF_SEASON" | "PREPARING" | "LIVE" | "COMPLETE";

export type TrackerState =
  | "OFF_SEASON"
  | "PREPARING"
  | "LIVE_AT_STOP"
  | "IN_TRANSIT"
  | "UK_SPECIAL_WINDOW"
  | "COMPLETE";

export interface MapPosition {
  lat: number;
  lng: number;
  x: number;
  y: number;
}

export interface CountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export interface DashboardData {
  mode: SeasonalMode;
  state: TrackerState;
  currentStopName: string;
  currentStopFlag: string;
  currentStopRegion: string;
  localTimeAtStop: string;
  nextStopName: string;
  nextStopFlag: string;
  etaText: string;
  etaMs: number;
  progressPercent: number;
  visitedCount: number;
  totalStops: number;
  remainingCount: number;
  estimatedGifts: number;
  estimatedDistanceKm: number;
  speedLabel: string;
  statusHeadline: string;
  statusSubtext: string;
  approachingUK: boolean;
  mapPosition: MapPosition;
  countdownToChristmasEve: CountdownValues;
  countdownToUK: CountdownValues;
  currentFunFact: string;
  holiday: HolidayDestination | null;
}

export function isHolidaySeason(now: Date): boolean {
  const month = now.getUTCMonth();
  return month >= 2 && month <= 10;
}

export function isDecemberPrep(now: Date): boolean {
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  return month === 11 && day >= 1 && day <= 23;
}

export function isChristmasInJuly(now: Date): boolean {
  return now.getUTCMonth() === 6;
}

export function getRandomHoliday(): HolidayDestination {
  const index = Math.floor(Math.random() * holidayDestinations.length);
  return holidayDestinations[index];
}

function getChristmasEveYear(now: Date): number {
  const year = now.getUTCFullYear();
  const journeyStart = new Date(Date.UTC(year, 11, 24, TRACKER_CONSTANTS.journeyStartUtcHour, 0, 0));
  const journeyEnd = new Date(Date.UTC(year, 11, 24, TRACKER_CONSTANTS.journeyEndUtcHour, 0, 0));

  if (now >= journeyStart && now <= journeyEnd) return year;

  const prevYearEnd = new Date(Date.UTC(year - 1, 11, 24, TRACKER_CONSTANTS.journeyEndUtcHour, 0, 0));
  if (now <= prevYearEnd) return year - 1;

  return year;
}

function getJourneyStartTime(year: number): Date {
  return new Date(Date.UTC(year, 11, 24, TRACKER_CONSTANTS.journeyStartUtcHour, 0, 0));
}

function getJourneyEndTime(year: number): Date {
  return new Date(Date.UTC(year, 11, 24, TRACKER_CONSTANTS.journeyEndUtcHour, 0, 0));
}

function getStopArrivals(year: number): { stop: SantaStop; arrival: Date }[] {
  return santaStops.map((stop) => ({
    stop,
    arrival: getStopArrivalDate(stop, year),
  }));
}

export function getSeasonalTrackerMode(now: Date): SeasonalMode {
  const year = getChristmasEveYear(now);
  const journeyStart = getJourneyStartTime(year);
  const journeyEnd = getJourneyEndTime(year);

  const dec24Start = new Date(Date.UTC(year, 11, 24, 0, 0, 0));

  if (now >= journeyStart && now <= journeyEnd) return "LIVE";
  if (now >= dec24Start && now < journeyStart) return "PREPARING";
  if (now > journeyEnd) {
    const dec26 = new Date(Date.UTC(year, 11, 26, 0, 0, 0));
    if (now < dec26) return "COMPLETE";
  }
  return "OFF_SEASON";
}

export function getSantaTrackerState(now: Date): TrackerState {
  const mode = getSeasonalTrackerMode(now);
  if (mode === "OFF_SEASON") return "OFF_SEASON";
  if (mode === "PREPARING") return "PREPARING";
  if (mode === "COMPLETE") return "COMPLETE";

  const year = getChristmasEveYear(now);
  const arrivals = getStopArrivals(year);
  const ukStop = arrivals.find((a) => a.stop.milestoneType === "uk");

  if (ukStop) {
    const ukArrival = ukStop.arrival.getTime();
    const windowMs = TRACKER_CONSTANTS.ukSpecialWindowHours * 60 * 60 * 1000;
    const nowMs = now.getTime();
    if (nowMs >= ukArrival - windowMs && nowMs <= ukArrival + ukStop.stop.dwellMinutes * 60 * 1000) {
      return "UK_SPECIAL_WINDOW";
    }
  }

  for (let i = 0; i < arrivals.length; i++) {
    const { stop, arrival } = arrivals[i];
    const arrivalMs = arrival.getTime();
    const dwellMs = stop.dwellMinutes * 60 * 1000;
    const nowMs = now.getTime();

    if (nowMs >= arrivalMs && nowMs <= arrivalMs + dwellMs) {
      return "LIVE_AT_STOP";
    }
  }

  return "IN_TRANSIT";
}

export function getCurrentStop(now: Date): SantaStop | null {
  const mode = getSeasonalTrackerMode(now);
  if (mode !== "LIVE") return null;

  const year = getChristmasEveYear(now);
  const arrivals = getStopArrivals(year);
  const nowMs = now.getTime();

  for (let i = arrivals.length - 1; i >= 0; i--) {
    if (nowMs >= arrivals[i].arrival.getTime()) {
      return arrivals[i].stop;
    }
  }

  return santaStops[0];
}

export function getNextStop(now: Date): SantaStop | null {
  const mode = getSeasonalTrackerMode(now);
  if (mode === "COMPLETE") return null;
  if (mode !== "LIVE") return santaStops[0];

  const year = getChristmasEveYear(now);
  const arrivals = getStopArrivals(year);
  const nowMs = now.getTime();

  for (let i = 0; i < arrivals.length; i++) {
    if (nowMs < arrivals[i].arrival.getTime()) {
      return arrivals[i].stop;
    }
  }

  return null;
}

export function getPreviousStop(now: Date): SantaStop | null {
  const year = getChristmasEveYear(now);
  const arrivals = getStopArrivals(year);
  const nowMs = now.getTime();

  for (let i = arrivals.length - 1; i >= 0; i--) {
    if (nowMs >= arrivals[i].arrival.getTime()) {
      return i > 0 ? arrivals[i - 1].stop : null;
    }
  }

  return null;
}

export function getJourneyProgress(now: Date): number {
  const year = getChristmasEveYear(now);
  const start = getJourneyStartTime(year).getTime();
  const end = getJourneyEndTime(year).getTime();
  const nowMs = now.getTime();

  if (nowMs <= start) return 0;
  if (nowMs >= end) return 100;

  return ((nowMs - start) / (end - start)) * 100;
}

function latLngToXY(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng + 180) / 360) * 100,
    y: ((90 - lat) / 180) * 100,
  };
}

export function getInterpolatedMapPosition(now: Date): MapPosition {
  const mode = getSeasonalTrackerMode(now);

  if (mode === "OFF_SEASON" || mode === "PREPARING") {
    return { lat: 90, lng: 0, ...latLngToXY(90, 0) };
  }

  if (mode === "COMPLETE") {
    const last = santaStops[santaStops.length - 1];
    return { lat: last.lat, lng: last.lng, ...latLngToXY(last.lat, last.lng) };
  }

  const year = getChristmasEveYear(now);
  const arrivals = getStopArrivals(year);
  const nowMs = now.getTime();

  let currentIdx = 0;
  for (let i = arrivals.length - 1; i >= 0; i--) {
    if (nowMs >= arrivals[i].arrival.getTime()) {
      currentIdx = i;
      break;
    }
  }

  if (currentIdx >= arrivals.length - 1) {
    const last = santaStops[santaStops.length - 1];
    return { lat: last.lat, lng: last.lng, ...latLngToXY(last.lat, last.lng) };
  }

  const currentArrival = arrivals[currentIdx];
  const dwellEndMs = currentArrival.arrival.getTime() + currentArrival.stop.dwellMinutes * 60 * 1000;

  if (nowMs <= dwellEndMs) {
    return {
      lat: currentArrival.stop.lat,
      lng: currentArrival.stop.lng,
      ...latLngToXY(currentArrival.stop.lat, currentArrival.stop.lng),
    };
  }

  const nextArrival = arrivals[currentIdx + 1];
  const segmentStart = dwellEndMs;
  const segmentEnd = nextArrival.arrival.getTime();
  const t = Math.max(0, Math.min(1, (nowMs - segmentStart) / (segmentEnd - segmentStart)));

  const lat = currentArrival.stop.lat + (nextArrival.stop.lat - currentArrival.stop.lat) * t;

  let lngDiff = nextArrival.stop.lng - currentArrival.stop.lng;
  if (Math.abs(lngDiff) > 180) {
    lngDiff = lngDiff > 0 ? lngDiff - 360 : lngDiff + 360;
  }
  let lng = currentArrival.stop.lng + lngDiff * t;
  if (lng > 180) lng -= 360;
  if (lng < -180) lng += 360;

  return { lat, lng, ...latLngToXY(lat, lng) };
}

function msToCountdown(ms: number): CountdownValues {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0 };
  return {
    days: Math.floor(ms / (1000 * 60 * 60 * 24)),
    hours: Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((ms % (1000 * 60)) / 1000),
    totalMs: ms,
  };
}

export function getCountdownToStart(now: Date): CountdownValues {
  const year = now.getUTCFullYear();
  let target = new Date(Date.UTC(year, 11, 24, TRACKER_CONSTANTS.journeyStartUtcHour, 0, 0));
  if (now.getTime() > target.getTime()) {
    target = new Date(Date.UTC(year + 1, 11, 24, TRACKER_CONSTANTS.journeyStartUtcHour, 0, 0));
  }
  return msToCountdown(target.getTime() - now.getTime());
}

export function getCountdownToUK(now: Date): CountdownValues {
  const year = getChristmasEveYear(now);
  const ukStop = santaStops.find((s) => s.milestoneType === "uk");
  if (!ukStop) return msToCountdown(0);
  const ukArrival = getStopArrivalDate(ukStop, year);
  return msToCountdown(Math.max(0, ukArrival.getTime() - now.getTime()));
}

export function getCountdownToNextStop(now: Date): CountdownValues {
  const next = getNextStop(now);
  if (!next) return msToCountdown(0);
  const year = getChristmasEveYear(now);
  const arrival = getStopArrivalDate(next, year);
  return msToCountdown(Math.max(0, arrival.getTime() - now.getTime()));
}

function formatLocalTime(utcOffset: number, now: Date): string {
  const localMs = now.getTime() + utcOffset * 60 * 60 * 1000;
  const localDate = new Date(localMs);
  const h = localDate.getUTCHours();
  const m = localDate.getUTCMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

function getStatusTexts(state: TrackerState, current: SantaStop | null, next: SantaStop | null): { headline: string; subtext: string } {
  switch (state) {
    case "OFF_SEASON":
      return {
        headline: "Santa is at the North Pole",
        subtext: "Checking his lists, feeding the reindeer, and preparing for the big night",
      };
    case "PREPARING":
      return {
        headline: "Final Preparations Underway",
        subtext: "The sleigh is loaded, the reindeer are ready — Santa departs soon!",
      };
    case "UK_SPECIAL_WINDOW":
      if (current && current.milestoneType === "uk") {
        return {
          headline: "Santa is Delivering in the UK!",
          subtext: "He's here! Santa is flying across Britain right now — stockings are being filled!",
        };
      }
      return {
        headline: "Santa is Approaching the UK!",
        subtext: `Currently delivering in ${current?.name || "Europe"} — the UK is next!`,
      };
    case "LIVE_AT_STOP":
      return {
        headline: `Delivering in ${current?.name || "..."}`,
        subtext: `Santa is flying across ${current?.region || "the region"}, spreading festive magic and filling stockings`,
      };
    case "IN_TRANSIT":
      return {
        headline: next ? `En Route to ${next.name}` : "Completing deliveries",
        subtext: current
          ? `Just finished ${current.name} — heading ${next ? `to ${next.region}` : "home"}`
          : "Santa's sleigh is on the move!",
      };
    case "COMPLETE":
      return {
        headline: "Journey Complete!",
        subtext: "Santa has delivered gifts to every corner of the globe. Merry Christmas!",
      };
  }
}

export function getDashboardData(now: Date): DashboardData {
  const mode = getSeasonalTrackerMode(now);
  const state = getSantaTrackerState(now);
  const current = getCurrentStop(now);
  const next = getNextStop(now);
  const progress = getJourneyProgress(now);
  const mapPosition = getInterpolatedMapPosition(now);
  const countdownToStart = getCountdownToStart(now);
  const countdownToUK = getCountdownToUK(now);
  const { headline, subtext } = getStatusTexts(state, current, next);

  const year = getChristmasEveYear(now);
  const arrivals = getStopArrivals(year);
  const nowMs = now.getTime();
  const visitedCount = arrivals.filter((a) => nowMs >= a.arrival.getTime()).length;
  const remainingCount = santaStops.length - visitedCount;

  const progressFraction = progress / 100;
  const estimatedGifts = Math.round(TRACKER_CONSTANTS.totalEstimatedGifts * progressFraction);
  const estimatedDistanceKm = Math.round(TRACKER_CONSTANTS.totalEstimatedDistanceKm * progressFraction);

  const nextCountdown = getCountdownToNextStop(now);
  const etaMs = nextCountdown.totalMs;
  let etaText = "—";
  if (next && etaMs > 0) {
    if (nextCountdown.hours > 0) {
      etaText = `${nextCountdown.hours}h ${nextCountdown.minutes}m`;
    } else {
      etaText = `${nextCountdown.minutes}m ${nextCountdown.seconds}s`;
    }
  }

  const ukStop = santaStops.find((s) => s.milestoneType === "uk");
  const ukArrival = ukStop ? getStopArrivalDate(ukStop, year) : null;
  const approachingUK =
    mode === "LIVE" &&
    ukArrival !== null &&
    nowMs < ukArrival.getTime() &&
    ukArrival.getTime() - nowMs <= TRACKER_CONSTANTS.ukSpecialWindowHours * 60 * 60 * 1000;

  const speedLabel = mode === "LIVE" ? "6,650,000 mph" : "—";

  return {
    mode,
    state,
    currentStopName: state === "IN_TRANSIT" && next ? `En route to ${next.name}` : (current?.name || "North Pole"),
    currentStopFlag: state === "IN_TRANSIT" && next ? "✈️" : (current?.flag || "🎅"),
    currentStopRegion: state === "IN_TRANSIT" && next ? next.region : (current?.region || "Arctic"),
    localTimeAtStop: current ? formatLocalTime(current.utcOffset, now) : "—",
    nextStopName: next?.name || "—",
    nextStopFlag: next?.flag || "",
    etaText,
    etaMs,
    progressPercent: Math.round(progress * 10) / 10,
    visitedCount,
    totalStops: santaStops.length,
    remainingCount,
    estimatedGifts,
    estimatedDistanceKm,
    speedLabel,
    statusHeadline: headline,
    statusSubtext: subtext,
    approachingUK,
    mapPosition,
    countdownToChristmasEve: countdownToStart,
    countdownToUK: countdownToUK,
    currentFunFact: current?.funFact || "Santa is busy preparing at the North Pole!",
    holiday: null,
  };
}

export function getVisitedStops(now: Date): Set<string> {
  const mode = getSeasonalTrackerMode(now);
  if (mode !== "LIVE" && mode !== "COMPLETE") return new Set();

  const year = getChristmasEveYear(now);
  const arrivals = getStopArrivals(year);
  const nowMs = now.getTime();
  const visited = new Set<string>();

  for (const { stop, arrival } of arrivals) {
    if (nowMs >= arrival.getTime()) {
      visited.add(stop.id);
    }
  }

  return visited;
}

export function getCurrentStopId(now: Date): string | null {
  const current = getCurrentStop(now);
  return current?.id || null;
}

export { santaStops, formatNumber };
export type { HolidayDestination };
