const labels = [
  { name: "North America", lat: 48, lng: -105, lines: ["North", "America"] },
  { name: "South America", lat: -18, lng: -59, lines: ["South", "America"] },
  { name: "Europe", lat: 53, lng: 20 },
  { name: "Africa", lat: 8, lng: 21 },
  { name: "Asia", lat: 46, lng: 93 },
  { name: "Australia", lat: -25, lng: 134 },
  { name: "Antarctica", lat: -79, lng: 25 },
  { name: "Pacific Ocean", lat: 3, lng: -139, ocean: true, lines: ["Pacific", "Ocean"] },
  { name: "Pacific Ocean", lat: 9, lng: 154, ocean: true, lines: ["Pacific", "Ocean"] },
  { name: "Atlantic Ocean", lat: 12, lng: -34, ocean: true, lines: ["Atlantic", "Ocean"] },
  { name: "Indian Ocean", lat: -20, lng: 78, ocean: true, lines: ["Indian", "Ocean"] },
  { name: "Arctic Ocean", lat: 80, lng: -20, ocean: true },
  { name: "Southern Ocean", lat: -59, lng: 48, ocean: true },
];

export default function MapGeographyLabels({ scale = 1, wrapPacific = false }: {
  scale?: number;
  wrapPacific?: boolean;
}) {
  const size = 12 * scale;
  return (
    <g data-geography-labels="" pointerEvents="none" textAnchor="middle"
      fontFamily="inherit" fontSize={size} fontWeight={500}
      stroke="#173c46" strokeWidth={2 * scale} strokeOpacity={0.55}
      strokeLinejoin="round" paintOrder="stroke" fill="#fff8e7" fillOpacity={0.8}>
      {labels.map(label => {
        const x = (label.lng + 180) / 360 * 1000;
        const y = (90 - label.lat) / 180 * 500;
        const lines = label.lines ?? [label.name];
        return (
          <text key={`${label.name}-${label.lng}`} aria-label={label.name}
            x={wrapPacific && x < 500 ? x + 1000 : x} y={y}
            fontStyle={label.ocean ? "italic" : undefined}>
            {lines.map((line, index) => (
              <tspan key={line} x={wrapPacific && x < 500 ? x + 1000 : x}
                dy={index === 0 ? -(lines.length - 1) * size * 0.55 : size * 1.1}>
                {line}
              </tspan>
            ))}
          </text>
        );
      })}
    </g>
  );
}
