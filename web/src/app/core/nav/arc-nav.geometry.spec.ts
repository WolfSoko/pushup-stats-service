import {
  arcDrop,
  arcOffsets,
  arcOpacity,
  arcScale,
  centeredScrollLeft,
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
    const offsets = arcOffsets(items, viewport);

    // then
    expect(offsets).toEqual([-2, -1, 0, 1, 2]);
  });

  it('should clamp items far outside the strip', () => {
    // given
    const viewport = { scrollLeft: 0, clientWidth: 100 };

    // when / then — nothing beyond ±2.5 matters visually
    expect(arcOffsets(items, viewport)[4]).toBe(2.5);
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
    expect(arcDrop(2.5)).toBe(14);
    expect(arcOpacity(2.5)).toBeCloseTo(0.55);
  });

  it('should follow a curve, not a line, on the way down', () => {
    // when / then — halfway out drops a quarter of the way, like a circle
    expect(arcDrop(1.25)).toBeCloseTo(3.5);
    expect(arcScale(-1.25)).toBe(arcScale(1.25));
  });
});
