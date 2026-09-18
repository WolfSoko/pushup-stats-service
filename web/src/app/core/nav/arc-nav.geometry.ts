/**
 * The arithmetic behind the arc nav, kept free of Angular so the curve
 * and the centring can be tested with plain numbers.
 */

/** Pointer travel below this still counts as a click, not a drag. */
export const DRAG_THRESHOLD_PX = 6;

/** Accumulated wheel travel that moves the strip on by one item. */
export const WHEEL_STEP_PX = 40;

/** How far from the centre, in item widths, an item stops shrinking. */
const EDGE = 2.5;

/**
 * How far the top edge bulges above the strip's corners: the vertical
 * radius of `border-radius: 50% 50% 0 0 / 28px 28px 0 0` in
 * arc-nav.component.scss. Both halves of that radius are 50% wide, so the
 * whole top edge is one ellipse — half as wide as the strip, this tall —
 * and the items ride it.
 */
export const ARC_RISE_PX = 28;

/**
 * The ellipse turns vertical at the very corner, so the tangent there
 * would stand an item on its side — for a lean nobody sees, that far
 * behind the curved edge. The tilt stops here instead.
 */
const MAX_TILT_DEG = 12;

/**
 * The widest the strip gets: the `max-width` in arc-nav.component.scss.
 * It is centred, so on a narrower viewport the strip is the viewport.
 */
export const STRIP_MAX_PX = 760;

/** One item, as laid out by `$item-width` in the same stylesheet. */
const SEED_ITEM_PX = 88;

/** How far the strip reaches either side of its middle on this viewport. */
export function stripHalf(viewportWidth: number): number {
  return Math.min(viewportWidth, STRIP_MAX_PX) / 2;
}

/** Where one item sits on the arc, and how it leans there. */
export interface ArcPosition {
  /**
   * Distance from the middle in item widths, clamped to ±EDGE. A measure
   * of attention — it drives how large and how bright the item is.
   */
  readonly d: number;
  /** How far the item sits below the top of the strip, in px. */
  readonly drop: number;
  /** How far it leans out of the vertical, in degrees. */
  readonly tilt: number;
}

/** The middle of the strip: largest, highest, brightest, upright. */
export const ARC_ORIGIN: ArcPosition = { d: 0, drop: 0, tilt: 0 };

interface Box {
  readonly offsetLeft: number;
  readonly offsetWidth: number;
}

interface Viewport {
  readonly scrollLeft: number;
  readonly clientWidth: number;
}

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/** Two decimals is finer than a screen can show, and keeps the DOM tidy. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Each item's centre measured from the viewport's centre. Zero is the
 * item in the middle.
 */
export function arcPositions(
  items: ReadonlyArray<Box>,
  viewport: Viewport
): ArcPosition[] {
  const half = viewport.clientWidth / 2;
  const middle = viewport.scrollLeft + half;
  return items.map((item) => {
    const width = item.offsetWidth || 1;
    const dx = item.offsetLeft + width / 2 - middle;
    return onArc(clamp(dx / width, EDGE), half > 0 ? dx / half : 0, half);
  });
}

/**
 * One item placed on the arc: `d` in item widths for its size and fade,
 * `u` as a fraction of the strip's half-width — ±1 at its corners — for
 * where on the curve it rides and which way the curve is heading there.
 */
function onArc(d: number, u: number, half: number): ArcPosition {
  return { d, drop: arcDrop(u), tilt: arcTilt(u, half) };
}

/**
 * Positions before anything has been measured: item `active` in the
 * middle, its neighbours one width apart. Gives the server render and the
 * first paint the same shape the measured strip will have — which is why
 * it needs `half`: the curve is the strip's own, so seeding a phone with
 * a desktop half-width would show a flat arc that snaps once measured.
 */
export function seedPositions(
  count: number,
  active: number,
  half = STRIP_MAX_PX / 2
): ArcPosition[] {
  const middle = active < 0 ? 0 : active;
  return Array.from({ length: count }, (_, i) =>
    onArc(clamp(i - middle, EDGE), ((i - middle) * SEED_ITEM_PX) / half, half)
  );
}

/**
 * The strip renders its entries three times so it can wrap. Given the
 * current scroll position, the width of one copy and of one item, the
 * shift that brings the position back into the middle copy — zero while
 * it is still there. The jump is a whole copy, so it is invisible.
 *
 * An item rests centred at `scrollLeft = renderedIndex * itemWidth`, so
 * the middle copy occupies [copyWidth, 2 * copyWidth - itemWidth]; the
 * thresholds sit half an item outside that, where no item ever rests.
 */
export function wrapShift(
  scrollLeft: number,
  copyWidth: number,
  itemWidth: number
): number {
  if (copyWidth <= 0) return 0;
  if (scrollLeft < copyWidth - itemWidth / 2) return copyWidth;
  if (scrollLeft > 2 * copyWidth - itemWidth / 2) return -copyWidth;
  return 0;
}

/** Index of the item closest to the middle, given measured positions. */
export function nearestIndex(positions: ReadonlyArray<ArcPosition>): number {
  let best = 0;
  positions.forEach((p, i) => {
    if (Math.abs(p.d) < Math.abs(positions[best].d)) best = i;
  });
  return best;
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
 * Vertical drop in px for an item at `u`: the ellipse the strip's top
 * border draws, `rise * (1 - sqrt(1 - u²))`, so an item travels along
 * that edge instead of merely sagging away from it. Nearly flat through
 * the middle, falling away steeply towards the corners — the shape of a
 * circle segment rather than of a parabola.
 */
export function arcDrop(u: number): number {
  const t = Math.min(1, Math.abs(u));
  return round(ARC_RISE_PX * (1 - Math.sqrt(1 - t * t)));
}

/**
 * Tilt in degrees for an item at `u` on a strip reaching `half` px either
 * side of its middle: the slope of the same ellipse, `atan(rise * u /
 * (half * sqrt(1 - u²)))`. An item leans out of the vertical the way a
 * carriage leans into a bend — upright at the top of the arc, tipping
 * further the steeper the curve runs under it.
 *
 * The lean is therefore the strip's own: a narrow strip carries the same
 * 28px rise over a shorter span, a steeper curve, and tips its items more.
 */
export function arcTilt(u: number, half: number): number {
  const t = clamp(u, 1);
  const flat = Math.sqrt(1 - t * t);
  if (half <= 0 || flat === 0) return Math.sign(t) * MAX_TILT_DEG;
  const rad = Math.atan((ARC_RISE_PX * t) / (half * flat));
  return round(clamp((rad * 180) / Math.PI, MAX_TILT_DEG));
}

/** Items far out fade so the middle of the strip reads as the focus. */
export function arcOpacity(d: number): number {
  const t = Math.min(1, Math.abs(d) / EDGE);
  return 1 - 0.45 * t;
}
