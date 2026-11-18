import { getChristmasEveYear, getJourneyEndTime, type SeasonalMode } from "./santaRoute";
import { isNewYearCelebration } from "./postChristmas";

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
  effectiveTime?: Date,
): SantaMarkerArtwork | null {
  if (mode === "LIVE") {
    return {
      src: `/images/tracker/santa-sleigh${sleighDirection === "left" ? "-left" : ""}.png`,
      mirrored: false, width: 48, height: 32,
    };
  }
  if (mode === "COMPLETE" && effectiveTime && isNewYearCelebration(effectiveTime)) {
    return {
      src: "/images/tracker/santa-party.png",
      mirrored: false, width: 36, height: 40,
    };
  }
  if (mode === "COMPLETE" && effectiveTime) {
    const elapsed = effectiveTime.getTime() - getJourneyEndTime(getChristmasEveYear(effectiveTime)).getTime();
    const shattered = elapsed >= 0 && elapsed < 8 * 60 * 60 * 1000;
    return {
      src: `/images/tracker/santa-${shattered ? "shattered" : "armchair"}.png`,
      mirrored: false, width: 40, height: 44,
    };
  }
  if (mode === "PREPARING" || mode === "COMPLETE") {
    return {
      src: "/images/tracker/santa-traditional-front.png",
      mirrored: false, width: 36, height: 40,
    };
  }
  const outfit = mode === "ROUTE_RESEARCH" ? "route-scout" : "holiday";
  return {
    src: `/images/tracker/santa-${outfit}${longitude === 0 ? "-front" : ""}.png`,
    mirrored: longitude > 0, width: 36, height: 40,
  };
}
