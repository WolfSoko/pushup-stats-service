export interface OverlaySize {
  readonly width: number;
  readonly height: number;
}

export interface OverlayPoint {
  readonly x: number;
  readonly y: number;
}

/** Maps one normalized landmark onto CSS pixels inside the stage box. */
export type LandmarkProjector = (landmark: OverlayPoint) => OverlayPoint;

/**
 * Builds the mapping from normalized `[0, 1]` landmark coordinates to
 * CSS pixels of a `<video>` box styled with `object-fit: cover`.
 *
 * Cover scales the source frame until it fills the box and crops the
 * overflow evenly on both sides, so a naive `x * width` mapping drifts
 * off the body as soon as the camera aspect ratio differs from the
 * element's — which on a phone it always does. `mirrored` mirrors the
 * x axis to match the preview's `transform: scaleX(-1)`; the overlay
 * itself must not be CSS-mirrored, or its angle labels would render
 * backwards.
 *
 * Returns null while the source has no dimensions yet (video metadata
 * not loaded); the caller then skips the frame.
 */
export function coverProjector(
  source: OverlaySize,
  stage: OverlaySize,
  mirrored: boolean
): LandmarkProjector | null {
  if (source.width <= 0 || source.height <= 0) return null;
  if (stage.width <= 0 || stage.height <= 0) return null;

  const scale = Math.max(
    stage.width / source.width,
    stage.height / source.height
  );
  const drawnWidth = source.width * scale;
  const drawnHeight = source.height * scale;
  const offsetX = (stage.width - drawnWidth) / 2;
  const offsetY = (stage.height - drawnHeight) / 2;

  return ({ x, y }) => ({
    x: offsetX + (mirrored ? 1 - x : x) * drawnWidth,
    y: offsetY + y * drawnHeight,
  });
}
