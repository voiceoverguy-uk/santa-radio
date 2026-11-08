export const MAP_PALETTE = {
  ocean: "#2F83B7",
  coastline: "#F1D6A3",
  grid: "#C6E7F2",
  routeOutline: "#17334A",
  route: "#FFD36F",
  currentLeg: "#FFF8E7",
  view: "#FFD36F",
  land: [
    "#78A967",
    "#91B777",
    "#568B59",
    "#A8B77B",
    "#B89A68",
    "#C58C62",
  ],
} as const;

export function mapLandColor(index: number): string {
  return MAP_PALETTE.land[index % MAP_PALETTE.land.length];
}
