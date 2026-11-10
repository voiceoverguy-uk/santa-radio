import { santaStops, type SantaStop } from "@/data/santaRouteStops";

export const MAP_W = 1000;
export const MAP_H = 500;

export interface Camera { cx: number; cy: number; w: number }

export const MAP_REGIONS: { name: string; box: [number, number, number, number] }[] = [
  // [west lng, south lat, east lng, north lat]
  { name: "Pacific", box: [-180, -25, -140, 25] },
  { name: "New Zealand", box: [164, -48, 180, -33] },
  { name: "Australia", box: [112, -44, 156, -10] },
  { name: "East Asia", box: [100, 18, 146, 50] },
  { name: "Southeast Asia", box: [92, -11, 142, 22] },
  { name: "South Asia", box: [60, 5, 98, 37] },
  { name: "Central Asia", box: [46, 35, 88, 56] },
  { name: "Middle East", box: [25, 12, 63, 42] },
  { name: "Europe", box: [-25, 35, 42, 71] },
  { name: "Africa", box: [-20, -36, 52, 37] },
  { name: "South America", box: [-82, -56, -34, 13] },
  { name: "Central America", box: [-118, 7, -59, 27] },
  { name: "North America", box: [-168, 24, -52, 72] },
  { name: "Antarctica", box: [-180, -90, 180, -60] },
];

const LEGACY: Record<string, string> = {
  Oceania: "Australia", "South East Asia": "Southeast Asia", Americas: "South America",
};

export function project(lat: number, lng: number) {
  return { x: ((lng + 180) / 360) * MAP_W, y: ((90 - lat) / 180) * MAP_H };
}

export function stopRegion(stop: SantaStop): string {
  const r = (stop as SantaStop & { mapRegion?: string }).mapRegion;
  if (r && MAP_REGIONS.some((m) => m.name === r)) return r;
  if (stop.id === "new-zealand") return "New Zealand";
  if (stop.region === "Americas" && stop.lat > 7) return stop.lat > 24 ? "North America" : "Central America";
  return LEGACY[stop.region] || (MAP_REGIONS.some((m) => m.name === stop.region) ? stop.region : "Pacific");
}

export const WORLD: Camera = { cx: 500, cy: 250, w: 1000 };

/** Keep Santa at the exact viewport centre, including poles and date-line crossings. */
export function positionCamera(point: { x: number; y: number }): Camera {
  return { cx: point.x, cy: point.y, w: 200 };
}

function boxCamera(x0: number, y0: number, x1: number, y1: number, pad = 0.18): Camera {
  let w = (x1 - x0) * (1 + pad * 2);
  let h = (y1 - y0) * (1 + pad * 2);
  w = Math.max(w, h * 2, 150);
  if (w >= 820) return WORLD;
  h = w / 2;
  let cx = (x0 + x1) / 2;
  let cy = (y0 + y1) / 2;
  cx = Math.min(Math.max(cx, w / 2), MAP_W - w / 2);
  cy = Math.min(Math.max(cy, h / 2), MAP_H - h / 2);
  return { cx, cy, w };
}

export function regionCamera(name: string): Camera {
  const stops = santaStops.filter(stop => stopRegion(stop) === name);
  if (stops.length) {
    const points = stops.map(stop => project(stop.lat, stop.lng));
    if (name === "Pacific") {
      // Centre the Pacific across the date line, not across Europe.
      const shifted = points.map(p => ({ x: (p.x < 500 ? p.x + 1000 : p.x) - 500, y: p.y }));
      const camera = boxCamera(Math.min(...shifted.map(p => p.x)), Math.min(...shifted.map(p => p.y)), Math.max(...shifted.map(p => p.x)), Math.max(...shifted.map(p => p.y)));
      return { ...camera, cx: camera.cx + 500 };
    }
    return boxCamera(Math.min(...points.map(p => p.x)), Math.min(...points.map(p => p.y)), Math.max(...points.map(p => p.x)), Math.max(...points.map(p => p.y)));
  }
  const r = MAP_REGIONS.find((m) => m.name === name);
  if (!r) return WORLD;
  const a = project(r.box[3], r.box[0]);
  const b = project(r.box[1], r.box[2]);
  return boxCamera(a.x, a.y, b.x, b.y, 0.06);
}

