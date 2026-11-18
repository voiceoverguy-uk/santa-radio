import { getJourneyEndTime } from "./santaRoute";
import { TRACKER_CONSTANTS, santaStops, getStopArrivalDate } from "@/data/santaRouteStops";

export type JumpTarget =
  | `city:${string}`
  | "new-years-eve"
  | "new-year-rest"
  | "holiday-start"
  | "holiday-end"
  | "research-start"
  | "research-end"
  | "preparation-start"
  | "christmas-eve-start"
  | "christmas-day-end"
  | "holiday-resumes"
  | "route-start"
  | "australia"
  | "asia"
  | "middle-east"
  | "uk-arrival"
  | "usa"
  | "chatham-islands"
  | "kathmandu"
  | "hawaii"
  | "american-samoa"
  | "complete";

export interface PreviewState {
  enabled: boolean;
  activatedAtRealMs: number;
  simulatedStartMs: number;
  speedMultiplier: number;
  jumpTarget: JumpTarget | null;
}

const STORAGE_KEY = "santa-tracker-preview";

const JUMP_TARGETS: Record<JumpTarget, { month: number; day: number; hour: number; minute: number }> = {
  "new-year-rest": { month: 0, day: 1, hour: 3, minute: 0 },
  "holiday-start": { month: 0, day: 2, hour: 0, minute: 0 },
  "new-years-eve": { month: 11, day: 31, hour: 18, minute: 0 },
  "holiday-end": { month: 10, day: 9, hour: 23, minute: 59 },
  "research-start": { month: 10, day: 10, hour: 0, minute: 0 },
  "research-end": { month: 11, day: 22, hour: 23, minute: 59 },
  "preparation-start": { month: 11, day: 23, hour: 0, minute: 0 },
  "christmas-eve-start": { month: 11, day: 24, hour: TRACKER_CONSTANTS.journeyStartUtcHour, minute: 0 },
  "christmas-day-end": { month: 11, day: 25, hour: 11, minute: 20 },
  "holiday-resumes": { month: 11, day: 26, hour: 0, minute: 0 },
  "route-start": { month: 11, day: 24, hour: TRACKER_CONSTANTS.journeyStartUtcHour, minute: 0 },
  australia: { month: 11, day: 24, hour: 13, minute: 0 },
  asia: { month: 11, day: 24, hour: 15, minute: 30 },
  "middle-east": { month: 11, day: 24, hour: 19, minute: 45 },
  "uk-arrival": { month: 11, day: 24, hour: 23, minute: 30 },
  usa: { month: 11, day: 25, hour: 5, minute: 0 },
  "chatham-islands": { month: 11, day: 24, hour: 10, minute: 15 },
  kathmandu: { month: 11, day: 24, hour: 18, minute: 15 },
  hawaii: { month: 11, day: 25, hour: 10, minute: 0 },
  "american-samoa": { month: 11, day: 25, hour: 11, minute: 0 },
  complete: { month: 11, day: 25, hour: 11, minute: 20 },
};

export function getJumpTime(target: JumpTarget): Date {
  const year = new Date().getUTCFullYear();
  const cities: Partial<Record<JumpTarget, string>> = {
    australia: "sydney", asia: "tokyo", "middle-east": "dubai",
    "uk-arrival": "london", usa: "newyork", hawaii: "honolulu", kathmandu: "kathmandu",
  };
  const cityId = target.startsWith("city:") ? target.slice(5) : cities[target];
  if (cityId) {
    const stop = santaStops.find(stop => stop.id === cityId);
    if (!stop) throw new Error(`Unknown itinerary destination: ${cityId}`);
    return getStopArrivalDate(stop, year);
  }
  const t = JUMP_TARGETS[target as keyof typeof JUMP_TARGETS];
  if (!t) throw new Error(`Unknown preview jump: ${target}`);
  if (target === "new-years-eve") return new Date(year, 11, 31, 18, 0, 0);
  if (target === "new-year-rest") return new Date(year + 1, 0, 1, 3, 0, 0);
  if (target === "holiday-start") return new Date(year + 1, 0, 2, 0, 0, 0);
  if (target === "christmas-day-end" || target === "complete") return getJourneyEndTime(year);
  return new Date(Date.UTC(year, t.month, t.day, t.hour, t.minute, 0));
}

export function getDefaultPreviewState(): PreviewState {
  return {
    enabled: false,
    activatedAtRealMs: Date.now(),
    simulatedStartMs: getJumpTime("route-start").getTime(),
    speedMultiplier: 1,
    jumpTarget: null,
  };
}

export function loadPreviewState(): PreviewState {
  if (typeof window === "undefined") return getDefaultPreviewState();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultPreviewState();

    const parsed = JSON.parse(raw);
    if (
      typeof parsed.enabled !== "boolean" ||
      typeof parsed.activatedAtRealMs !== "number" ||
      typeof parsed.simulatedStartMs !== "number" ||
      typeof parsed.speedMultiplier !== "number"
    ) {
      return getDefaultPreviewState();
    }

    return parsed as PreviewState;
  } catch {
    return getDefaultPreviewState();
  }
}

export function savePreviewState(state: PreviewState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable
  }
}

export function clearPreviewState(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getEffectiveTime(preview: PreviewState): Date {
  if (!preview.enabled) return new Date();

  const realElapsed = Date.now() - preview.activatedAtRealMs;
  const simulatedElapsed = realElapsed * preview.speedMultiplier;
  return new Date(preview.simulatedStartMs + simulatedElapsed);
}

export function activatePreview(
  target: JumpTarget = "route-start",
  speed: number = 1
): PreviewState {
  const state: PreviewState = {
    enabled: true,
    activatedAtRealMs: Date.now(),
    simulatedStartMs: getJumpTime(target).getTime(),
    speedMultiplier: speed,
    jumpTarget: target,
  };
  savePreviewState(state);
  return state;
}

export function deactivatePreview(): PreviewState {
  const state = getDefaultPreviewState();
  state.enabled = false;
  clearPreviewState();
  return state;
}

export function getRunFullJourneySpeed(durationMinutes: number): number {
  // Full preview runs from departure to the final delivery.
  const totalJourneyMs = (TRACKER_CONSTANTS.journeyEndUtcHour - TRACKER_CONSTANTS.journeyStartUtcHour) * 3600000;
  const targetMs = durationMinutes * 60 * 1000;
  return totalJourneyMs / targetMs;
}

export const JUMP_LABELS: { target: JumpTarget; label: string }[] = [
  { target: "research-start", label: "10 November" },
  { target: "christmas-eve-start", label: "24 December" },
  { target: "christmas-day-end", label: "25 December" },
  { target: "new-years-eve", label: "31 December · 6pm" },
  { target: "new-year-rest", label: "1 January · 3am" },
  { target: "holiday-start", label: "2 January · midnight" },
  { target: "route-start", label: "Route Start" },
  { target: "australia", label: "Australia" },
  { target: "asia", label: "Asia" },
  { target: "kathmandu", label: "Kathmandu" },
  { target: "middle-east", label: "Middle East" },
  { target: "uk-arrival", label: "UK Arrival" },
  { target: "usa", label: "USA" },
  { target: "hawaii", label: "Hawaii" },
  { target: "complete", label: "Complete" },
];
