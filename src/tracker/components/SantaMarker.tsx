import type { SantaMarkerArtwork } from "../lib/santaMarker";

/** Mirroring belongs to the image only, never the location or camera group. */
export default function SantaMarker({ artwork, scale = 1 }: {
  artwork: SantaMarkerArtwork;
  scale?: number;
}) {
  const width = artwork.width * scale;
  const height = artwork.height * scale;
  return (
    <image
      data-santa-artwork=""
      data-mirrored={String(artwork.mirrored)}
      href={artwork.src}
      x={-width / 2}
      y={-height / 2}
      width={width}
      height={height}
      preserveAspectRatio="xMidYMid meet"
      transform={artwork.mirrored ? "scale(-1 1)" : undefined}
      aria-hidden="true"
    />
  );
}
