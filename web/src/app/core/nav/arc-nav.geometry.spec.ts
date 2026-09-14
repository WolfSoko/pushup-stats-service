import {
  ARC_RISE_PX,
  arcDrop,
  arcOpacity,
  arcPositions,
  arcScale,
  arcTilt,
  centeredScrollLeft,
  nearestIndex,
  seedPositions,
  STRIP_MAX_PX,
  stripHalf,
  wrapShift,
} from './arc-nav.geometry';

describe('arc-nav geometry', () => {
  const items = [0, 1, 2, 3, 4].map((i) => ({
    offsetLeft: 100 + i * 80,
    offsetWidth: 80,
  }));

  it('should measure each item from the middle of the viewport, in item widths', () => {
    // given — a 400px strip scrolled so the third item is dead centre
    const viewport = { scrollLeft: 100, clientWidth: 400 };

    // when
    const positions = arcPositions(items, viewport);

    // then
    expect(positions.map((p) => p.d)).toEqual([-2, -1, 0, 1, 2]);
    // and — placed on the strip's own curve, leaning the way it runs:
    // upright and highest in the middle, tipping outwards either side
    expect(positions.map((p) => p.drop)).toEqual([11.2, 2.34, 0, 2.34, 11.2]);
    expect(positions.map((p) => p.tilt)).toEqual([-10.57, -3.5, 0, 3.5, 10.57]);
  });

  it('should clamp items far outside the strip', () => {
    // given
    const viewport = { scrollLeft: 0, clientWidth: 100 };

    // when / then — nothing beyond ±2.5 widths or past the corner matters
    const far = arcPositions(items, viewport)[4];
    expect(far.d).toBe(2.5);
    expect(far.drop).toBe(ARC_RISE_PX);
    expect(far.tilt).toBe(12);
  });

  it('should seed the same shape around the active item before measuring', () => {
    // when / then — the active one is the middle, neighbours a width apart
    expect(seedPositions(5, 2).map((p) => p.d)).toEqual([-2, -1, 0, 1, 2]);
    expect(seedPositions(5, -1).map((p) => p.d)).toEqual([0, 1, 2, 2.5, 2.5]);
    // and — one 88px item out on the widest the strip gets is a small
    // fraction of its half, so the seeded curve is the one measurement
    // will confirm rather than a steeper guess
    expect(seedPositions(5, 2)[3].drop).toBe(0.76);
    expect(seedPositions(5, 2)[3].tilt).toBe(1);
  });

  it('should seed the curve of the strip it is about to be measured on', () => {
    // given — a phone: the strip is the viewport, so its arc is steeper
    const half = stripHalf(360);

    // when
    const neighbour = seedPositions(5, 2, half)[3];

    // then — the same item the desktop seed leaves nearly flat
    expect(half).toBe(180);
    expect(neighbour.drop).toBeGreaterThan(seedPositions(5, 2)[3].drop);
    // and — it matches what measuring that strip would report
    const laid = [0, 1, 2, 3, 4].map((i) => ({
      offsetLeft: i * 88,
      offsetWidth: 88,
    }));
    const viewport = { clientWidth: 360, scrollLeft: 0 };
    const measured = arcPositions(laid, {
      ...viewport,
      scrollLeft: centeredScrollLeft(laid[2], viewport),
    })[3];
    expect(neighbour.drop).toBe(measured.drop);
    expect(neighbour.tilt).toBe(measured.tilt);
  });

  it('should cap the strip at its max width, and follow the viewport below', () => {
    // when / then
    expect(stripHalf(1280)).toBe(STRIP_MAX_PX / 2);
    expect(stripHalf(360)).toBe(180);
  });

  it('should jump a whole copy once the scroll leaves the middle one', () => {
    // given — 8 items of 88px, three copies: the middle one rests at 704..1320
    const copy = 8 * 88;

    // then — every resting position of the middle copy stays put
    expect(wrapShift(704, copy, 88)).toBe(0);
    expect(wrapShift(1320, copy, 88)).toBe(0);
    // the neighbouring clones' resting positions jump back
    expect(wrapShift(616, copy, 88)).toBe(copy);
    expect(wrapShift(1408, copy, 88)).toBe(-copy);
    // half an item beyond the copy is still the middle, a little more is not
    expect(wrapShift(661, copy, 88)).toBe(0);
    expect(wrapShift(659, copy, 88)).toBe(copy);
    expect(wrapShift(100, 0, 88)).toBe(0);
  });

  it('should find the item nearest the middle', () => {
    // when / then
    const at = (d: number) => ({ d, drop: 0, tilt: 0 });
    expect(nearestIndex([-1.6, -0.4, 0.6, 1.6].map(at))).toBe(1);
    expect(nearestIndex([])).toBe(0);
  });

  it('should compute the scroll position that centres an item', () => {
    // when / then
    expect(
      centeredScrollLeft(items[2], { scrollLeft: 0, clientWidth: 400 })
    ).toBe(100);
    // never negative — the first item just sits as far left as it can
    expect(
      centeredScrollLeft(items[0], { scrollLeft: 0, clientWidth: 800 })
    ).toBe(0);
  });

  it('should be largest, highest and brightest in the middle', () => {
    // when / then
    expect(arcScale(0)).toBeCloseTo(1.3);
    expect(arcDrop(0)).toBe(0);
    expect(arcOpacity(0)).toBe(1);
    expect(arcScale(2.5)).toBeCloseTo(0.8);
    expect(arcOpacity(2.5)).toBeCloseTo(0.55);
    // the drop bottoms out at the strip's corner, where its own top border
    // meets the side — the item is on the outline, not near it
    expect(arcDrop(1)).toBe(ARC_RISE_PX);
    expect(arcDrop(-1)).toBe(ARC_RISE_PX);
  });

  it('should ride the ellipse the strip is cut from', () => {
    // when / then — a circle segment barely dips through the middle and
    // then falls away hard: an eighth of the rise at half way out, well
    // over half of it at nine tenths
    expect(arcDrop(0.5)).toBeCloseTo(3.75, 2);
    expect(arcDrop(0.9)).toBeCloseTo(15.8, 1);
    // every point satisfies the ellipse: (u)² + ((rise - y) / rise)² = 1
    const u = 0.62;
    const y = arcDrop(u);
    expect(u ** 2 + ((ARC_RISE_PX - y) / ARC_RISE_PX) ** 2).toBeCloseTo(1, 3);
  });

  it('should lean each item onto the tangent of that ellipse', () => {
    // given — a strip reaching 380px either side of its middle
    const half = 380;

    // when / then — upright at the top, tipping outwards symmetrically
    expect(arcTilt(0, half)).toBe(0);
    expect(arcTilt(-0.5, half)).toBe(-arcTilt(0.5, half));

    // and — it really is the slope of arcDrop there, not a curve of its
    // own: the secant across a short span of the drop leans the same way
    const u = 0.6;
    const step = 0.05;
    const rise = arcDrop(u + step) - arcDrop(u - step);
    const run = 2 * step * half;
    expect(arcTilt(u, half)).toBeCloseTo(
      (Math.atan(rise / run) * 180) / Math.PI,
      1
    );
  });

  it('should lean harder on a narrow strip, whose curve is steeper', () => {
    // given — the same 28px rise over half the width is twice the slope

    // when / then
    expect(arcTilt(0.6, 180)).toBeGreaterThan(arcTilt(0.6, 380));

    // and — the ellipse stands vertical at the corner, an item never does
    expect(arcTilt(1, 380)).toBe(12);
    expect(arcTilt(-1, 180)).toBe(-12);
    expect(arcTilt(0.5, 0)).toBe(12);
  });
});
