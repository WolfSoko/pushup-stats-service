/**
 * The arithmetic behind the arc nav, kept free of Angular so the curve
 * and the centring can be tested with plain numbers.
 */

/** Pointer travel below this still counts as a click, not a drag. */
export const DRAG_THRESHOLD_PX = 6;

/** How far from the centre, in item widths, an item stops shrinking. */
const EDGE = 2.5;

interface Box {
  readonly offsetLeft: number;
  readonly offsetWidth: number;
}

interface Viewport {
  readonly scrollLeft: number;
  readonly clientWidth: number;
}

/**
 * Signed distance of each item's centre from the viewport's centre, in
 * item widths, clamped to ±EDGE. Zero is the item in the middle.
 */
export function arcOffsets(
  items: ReadonlyArray<Box>,
  viewport: Viewport
): number[] {
  const middle = viewport.scrollLeft + viewport.clientWidth / 2;
  return items.map((item) => {
    const width = item.offsetWidth || 1;
    const center = item.offsetLeft + width / 2;
    const d = (center - middle) / width;
    return Math.max(-EDGE, Math.min(EDGE, d));
  });
}

/** The scrollLeft that puts `item` in the middle of `viewport`. */
export function centeredScrollLeft(item: Box, viewport: Viewport): number {
  return Math.max(
    0,
    item.offsetLeft + item.offsetWidth / 2 - viewport.clientWidth / 2
  );
}

/** Scale for an item at distance `d`: 1.3 in the middle, 0.8 at the edge. */
export function arcScale(d: number): number {
  const t = Math.min(1, Math.abs(d) / EDGE);
  return 1.3 - 0.5 * t;
}

/**
 * Vertical drop for an item at distance `d`, in px: items follow a
 * circular arc that peaks in the middle, so the row reads as a segment.
 */
export function arcDrop(d: number): number {
  const t = Math.min(1, Math.abs(d) / EDGE);
  return 14 * t * t;
}

/** Items far out fade so the middle of the strip reads as the focus. */
export function arcOpacity(d: number): number {
  const t = Math.min(1, Math.abs(d) / EDGE);
  return 1 - 0.45 * t;
}
