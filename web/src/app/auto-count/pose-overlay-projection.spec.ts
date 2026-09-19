import { describe, expect, it } from 'vitest';

import { coverProjector } from './pose-overlay-projection';

describe('coverProjector', () => {
  it('given a stage with the same aspect ratio, when projecting, then coordinates scale straight through', () => {
    // given
    const project = coverProjector(
      { width: 640, height: 480 },
      { width: 320, height: 240 },
      false
    );

    // when
    const point = project?.({ x: 0.5, y: 0.25 });

    // then
    expect(point).toEqual({ x: 160, y: 60 });
  });

  it('given a stage narrower than the source, when projecting, then the crop is centred horizontally', () => {
    // given — 4:3 source in a 1:1 box: cover scales to height, crops the sides
    const project = coverProjector(
      { width: 640, height: 480 },
      { width: 480, height: 480 },
      false
    );

    // when
    const centre = project?.({ x: 0.5, y: 0.5 });
    const leftEdge = project?.({ x: 0, y: 0 });

    // then
    expect(centre).toEqual({ x: 240, y: 240 });
    expect(leftEdge?.x).toBeCloseTo(-80, 5);
    expect(leftEdge?.y).toBeCloseTo(0, 5);
  });

  it('given a portrait source in a square stage, when projecting, then the crop is centred vertically', () => {
    // given — 3:4 source in a 1:1 box: cover scales to width, crops top and bottom
    const project = coverProjector(
      { width: 480, height: 640 },
      { width: 640, height: 640 },
      false
    );

    // when
    const topEdge = project?.({ x: 0, y: 0 });

    // then
    expect(topEdge?.x).toBeCloseTo(0, 5);
    expect(topEdge?.y).toBeCloseTo(-106.666, 2);
  });

  it('given a mirrored preview, when projecting, then the x axis is flipped but y is untouched', () => {
    // given
    const project = coverProjector(
      { width: 640, height: 480 },
      { width: 320, height: 240 },
      true
    );

    // when
    const point = project?.({ x: 0.25, y: 0.25 });

    // then
    expect(point).toEqual({ x: 240, y: 60 });
  });

  it('given a video whose metadata has not loaded yet, when building the projector, then it is null', () => {
    // given / when
    const project = coverProjector(
      { width: 0, height: 0 },
      { width: 320, height: 240 },
      false
    );

    // then
    expect(project).toBeNull();
  });

  it('given a stage that has not been laid out yet, when building the projector, then it is null', () => {
    // given / when
    const project = coverProjector(
      { width: 640, height: 480 },
      { width: 0, height: 0 },
      false
    );

    // then
    expect(project).toBeNull();
  });
});
