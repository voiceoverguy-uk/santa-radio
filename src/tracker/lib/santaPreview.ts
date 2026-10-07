export type JumpTarget =
  | "route-start"
  | "australia"
  | "asia"
  | "middle-east"
  | "uk-arrival"
  | "usa"
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
  "route-start": { month: 11, day: 24, hour: 9, minute: 55 },
  australia: { month: 11, day: 24, hour: 13, minute: 0 },
  asia: { month: 11, day: 24, hour: 15, minute: 30 },
  "middle-east": { month: 11, day: 24, hour: 19, minute: 45 },
  "uk-arrival": { month: 11, day: 24, hour: 23, minute: 30 },
  usa: { month: 11, day: 25, hour: 5, minute: 0 },
  complete: { month: 11, day: 25, hour: 10, minute: 5 },
};

export function getJumpTime(target: JumpTarget): Date {
  const t = JUMP_TARGETS[target];
  const year = new Date().getUTCFullYear();
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
  const totalJourneyMs = 24 * 60 * 60 * 1000;
  const targetMs = durationMinutes * 60 * 1000;
  return totalJourneyMs / targetMs;
}

export const JUMP_LABELS: { target: JumpTarget; label: string }[] = [
  { target: "route-start", label: "Route Start" },
  { target: "australia", label: "Australia" },
  { target: "asia", label: "Asia" },
  { target: "middle-east", label: "Middle East" },
  { target: "uk-arrival", label: "UK Arrival" },
  { target: "usa", label: "USA" },
  { target: "complete", label: "Complete" },
];
