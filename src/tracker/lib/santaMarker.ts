import type { SeasonalMode } from "./santaRoute";

export interface SantaMarkerArtwork {
  src: string;
  mirrored: boolean;
  width: number;
  height: number;
}

/** Geographic Greenwich meridian, independent of local clocks and map cameras. */
export function getSantaMarkerArtwork(
  mode: SeasonalMode,
  longitude: number,
  sleighDirection: "left" | "right" = "left",
): SantaMarkerArtwork | null {
  if (mode === "LIVE") {
    return {
      src: `/images/tracker/santa-sleigh${sleighDirection === "left" ? "-left" : ""}.png`,
      mirrored: false, width: 48, height: 32,
    };
  }
  if (mode !== "OFF_SEASON" && mode !== "ROUTE_RESEARCH") return null;
  const outfit = mode === "ROUTE_RESEARCH" ? "route-scout" : "holiday";
  return {
    src: `/images/tracker/santa-${outfit}${longitude === 0 ? "-front" : ""}.png`,
    mirrored: longitude > 0, width: 36, height: 40,
  };
}
