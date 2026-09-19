import { POSE_LANDMARK, type PoseLandmark } from '@pu-stats/auto-count';
import { describe, expect, it } from 'vitest';

import { drawPoseOverlay } from './draw-pose-overlay';
import type { LandmarkProjector } from './pose-overlay-projection';

interface RecordedLine {
  readonly from: { x: number; y: number };
  readonly to: { x: number; y: number };
  readonly color: string;
  readonly width: number;
}

interface RecordedArc {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

/**
 * Records what was drawn instead of rendering it, so the drawing rules
 * (which bones, which colour, which label) are assertable without a
 * real canvas.
 */
class RecordingContext {
  strokeStyle = '';
  fillStyle = '';
  lineWidth = 0;
  lineCap = '';
  lineJoin = '';
  font = '';
  textAlign = '';
  textBaseline = '';

  readonly lines: RecordedLine[] = [];
  readonly dots: Array<RecordedArc & { color: string }> = [];
  readonly arcs: RecordedArc[] = [];
  readonly texts: Array<{ text: string; x: number; y: number }> = [];

  private path: Array<{ x: number; y: number }> = [];
  private arc_: RecordedArc | null = null;

  beginPath(): void {
    this.path = [];
    this.arc_ = null;
  }
  moveTo(x: number, y: number): void {
    this.path.push({ x, y });
  }
  lineTo(x: number, y: number): void {
    this.path.push({ x, y });
  }
  arc(x: number, y: number, radius: number): void {
    this.arc_ = { x, y, radius };
  }
  stroke(): void {
    if (this.arc_) {
      this.arcs.push(this.arc_);
      return;
    }
    const [from, to] = this.path;
    if (from && to) {
      this.lines.push({
        from,
        to,
        color: this.strokeStyle,
        width: this.lineWidth,
      });
    }
  }
  fill(): void {
    if (this.arc_) this.dots.push({ ...this.arc_, color: this.fillStyle });
  }
  strokeText(): void {
    // Halo pass; the visible text is recorded in fillText.
  }
  fillText(text: string, x: number, y: number): void {
    this.texts.push({ text, x, y });
  }
}

const ACTIVE_COLOR = '#ffc400';
const IDENTITY: LandmarkProjector = ({ x, y }) => ({ x, y });

const ELBOW_TRIPLET = [
  POSE_LANDMARK.LEFT_SHOULDER,
  POSE_LANDMARK.LEFT_ELBOW,
  POSE_LANDMARK.LEFT_WRIST,
] as const;

const makeLandmarks = (
  overrides: Partial<Record<number, PoseLandmark>>
): ReadonlyArray<PoseLandmark> => {
  const arr: PoseLandmark[] = [];
  for (let i = 0; i < 33; i++) arr[i] = { x: 0, y: 0, visibility: 0 };
  for (const [idx, lm] of Object.entries(overrides)) {
    if (lm) arr[Number(idx)] = lm;
  }
  return arr;
};

/** A right-angled left arm: shoulder above the elbow, wrist to its right. */
const BENT_LEFT_ARM = makeLandmarks({
  [POSE_LANDMARK.LEFT_SHOULDER]: { x: 100, y: 0, visibility: 0.9 },
  [POSE_LANDMARK.LEFT_ELBOW]: { x: 100, y: 100, visibility: 0.9 },
  [POSE_LANDMARK.LEFT_WRIST]: { x: 200, y: 100, visibility: 0.9 },
});

const draw = (
  landmarks: ReadonlyArray<PoseLandmark>,
  angleDeg: number | null = 90
): RecordingContext => {
  const ctx = new RecordingContext();
  drawPoseOverlay({
    ctx: ctx as unknown as CanvasRenderingContext2D,
    skeleton: { landmarks, triplet: ELBOW_TRIPLET },
    project: IDENTITY,
    angleDeg,
  });
  return ctx;
};

describe('drawPoseOverlay', () => {
  it('given a visible triplet, when drawn, then its bones use the accent colour and a heavier stroke', () => {
    // given / when
    const ctx = draw(BENT_LEFT_ARM);

    // then
    const upperArm = ctx.lines.find(
      (l) => l.from.x === 100 && l.from.y === 0 && l.to.y === 100
    );
    expect(upperArm?.color).toBe(ACTIVE_COLOR);
    const forearm = ctx.lines.find((l) => l.to.x === 200);
    expect(forearm?.color).toBe(ACTIVE_COLOR);
    expect(forearm?.width).toBeGreaterThan(3);
  });

  it('given landmarks the detector is unsure about, when drawn, then they are skipped entirely', () => {
    // given — same arm, all visibilities below the floor
    const faint = makeLandmarks({
      [POSE_LANDMARK.LEFT_SHOULDER]: { x: 100, y: 0, visibility: 0.2 },
      [POSE_LANDMARK.LEFT_ELBOW]: { x: 100, y: 100, visibility: 0.2 },
      [POSE_LANDMARK.LEFT_WRIST]: { x: 200, y: 100, visibility: 0.2 },
    });

    // when
    const ctx = draw(faint);

    // then
    expect(ctx.lines).toHaveLength(0);
    expect(ctx.dots).toHaveLength(0);
    expect(ctx.texts).toHaveLength(0);
  });

  it('given a measured angle, when drawn, then the arc sits at the joint and the label reads whole degrees', () => {
    // given / when
    const ctx = draw(BENT_LEFT_ARM, 89.6);

    // then
    expect(ctx.arcs).toHaveLength(1);
    expect(ctx.arcs[0]).toMatchObject({ x: 100, y: 100 });
    expect(ctx.texts).toEqual([expect.objectContaining({ text: '90°' })]);
  });

  it('given the arc label, when drawn, then it sits on the inner bisector between the two segments', () => {
    // given / when — segments point up and right, so the inside is up-right
    const ctx = draw(BENT_LEFT_ARM);

    // then
    const [label] = ctx.texts;
    expect(label.x).toBeGreaterThan(100);
    expect(label.y).toBeLessThan(100);
  });

  it('given no angle for this frame, when drawn, then the skeleton is drawn without arc or label', () => {
    // given / when
    const ctx = draw(BENT_LEFT_ARM, null);

    // then
    expect(ctx.lines.length).toBeGreaterThan(0);
    expect(ctx.arcs).toHaveLength(0);
    expect(ctx.texts).toHaveLength(0);
  });

  it('given a visible bone outside the measured triplet, when drawn, then it stays in the neutral colour', () => {
    // given
    const withLegs = makeLandmarks({
      [POSE_LANDMARK.LEFT_SHOULDER]: { x: 100, y: 0, visibility: 0.9 },
      [POSE_LANDMARK.LEFT_ELBOW]: { x: 100, y: 100, visibility: 0.9 },
      [POSE_LANDMARK.LEFT_WRIST]: { x: 200, y: 100, visibility: 0.9 },
      [POSE_LANDMARK.LEFT_HIP]: { x: 100, y: 200, visibility: 0.9 },
      [POSE_LANDMARK.LEFT_KNEE]: { x: 100, y: 300, visibility: 0.9 },
    });

    // when
    const ctx = draw(withLegs);

    // then
    const thigh = ctx.lines.find((l) => l.from.y === 200 && l.to.y === 300);
    expect(thigh?.color).not.toBe(ACTIVE_COLOR);
  });
});
