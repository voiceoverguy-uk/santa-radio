const MAP_WIDTH = 1000;
const MAP_HEIGHT = 500;
const LONGITUDE_SEGMENTS = 720;
const DEGREES_TO_RADIANS = Math.PI / 180;

export interface SolarPosition {
  declinationDeg: number;
  subsolarLongitudeDeg: number;
}

/** Approximate the Sun's declination and subsolar longitude from a UTC instant. */
export function getSolarPosition(time: Date): SolarPosition {
  const timestamp = time.getTime();
  if (!Number.isFinite(timestamp)) throw new RangeError("Solar lighting requires a valid date.");

  const year = time.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const nextYearStart = Date.UTC(year + 1, 0, 1);
  const daysInYear = (nextYearStart - yearStart) / 86_400_000;
  const dayOfYear = Math.floor((timestamp - yearStart) / 86_400_000);
  const utcHours =
    time.getUTCHours() +
    time.getUTCMinutes() / 60 +
    time.getUTCSeconds() / 3600 +
    time.getUTCMilliseconds() / 3_600_000;
  const gamma = (2 * Math.PI / daysInYear) * (dayOfYear - 1 + (utcHours - 12) / 24);

  const declination =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const subsolarLongitude = normalizeLongitude(180 - (utcHours * 60 + equationOfTime) / 4);

  return {
    declinationDeg: declination / DEGREES_TO_RADIANS,
    subsolarLongitudeDeg: subsolarLongitude,
  };
}

/** Return whether the Sun is below the geometric horizon at a location. */
export function isNightAt(latitudeDeg: number, longitudeDeg: number, time: Date): boolean {
  const { declinationDeg, subsolarLongitudeDeg } = getSolarPosition(time);
  const latitude = latitudeDeg * DEGREES_TO_RADIANS;
  const declination = declinationDeg * DEGREES_TO_RADIANS;
  const hourAngle = normalizeLongitude(longitudeDeg - subsolarLongitudeDeg) * DEGREES_TO_RADIANS;
  const sineAltitude =
    Math.sin(latitude) * Math.sin(declination) +
    Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle);
  return sineAltitude < 0;
}

/**
 * Build a narrow-band SVG path for the night side of an equirectangular world map.
 * Sampling each half-degree keeps the curved terminator smooth while naturally
 * joining both date-line edges and remaining valid in regional camera views.
 */
export function getNightOverlayPath(time: Date): string {
  const { declinationDeg, subsolarLongitudeDeg } = getSolarPosition(time);
  const declination = declinationDeg * DEGREES_TO_RADIANS;
  const path: string[] = [];
  const step = 360 / LONGITUDE_SEGMENTS;

  for (let i = 0; i < LONGITUDE_SEGMENTS; i++) {
    const west = -180 + i * step;
    const east = west + step;
    const middle = (west + east) / 2;
    const hourAngle = normalizeLongitude(middle - subsolarLongitudeDeg) * DEGREES_TO_RADIANS;
    const equatorialSun = Math.cos(declination) * Math.cos(hourAngle);
    const westX = (i / LONGITUDE_SEGMENTS) * MAP_WIDTH;
    const eastX = ((i + 1) / LONGITUDE_SEGMENTS) * MAP_WIDTH;

    if (Math.abs(declinationDeg) < 1e-7) {
      if (equatorialSun < 0) path.push(columnPath(westX, eastX, 0, MAP_HEIGHT));
      continue;
    }

    const boundaryLatitude = Math.atan(-Math.cos(declination) * Math.cos(hourAngle) / Math.sin(declination)) / DEGREES_TO_RADIANS;
    const boundaryY = Math.max(0, Math.min(MAP_HEIGHT, ((90 - boundaryLatitude) / 180) * MAP_HEIGHT));
    path.push(
      declinationDeg > 0
        ? columnPath(westX, eastX, boundaryY, MAP_HEIGHT)
        : columnPath(westX, eastX, 0, boundaryY),
    );
  }

  return path.join("");
}

function columnPath(westX: number, eastX: number, northY: number, southY: number): string {
  return `M${westX.toFixed(2)},${northY.toFixed(2)}L${eastX.toFixed(2)},${northY.toFixed(2)}L${eastX.toFixed(2)},${southY.toFixed(2)}L${westX.toFixed(2)},${southY.toFixed(2)}Z`;
}

function normalizeLongitude(longitude: number): number {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}
