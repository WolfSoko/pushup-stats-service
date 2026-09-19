import { POSE_BONES, type PoseSkeleton } from '@pu-stats/auto-count';

import type {
  LandmarkProjector,
  OverlayPoint,
} from './pose-overlay-projection';

/**
 * Fixed high-contrast colours rather than theme tokens: the overlay is
 * drawn onto a live camera image, not onto a themed surface, so it has
 * to stay readable over skin, clothing and whatever is on the wall.
 */
const BONE_COLOR = 'rgba(255, 255, 255, 0.72)';
const JOINT_COLOR = 'rgba(255, 255, 255, 0.92)';
const ACTIVE_COLOR = '#ffc400';
const LABEL_HALO = 'rgba(0, 0, 0, 0.85)';

const BONE_WIDTH = 3;
const ACTIVE_BONE_WIDTH = 5;
const JOINT_RADIUS = 4;
const ACTIVE_JOINT_RADIUS = 6;
/** Below this the detector is mostly guessing; drawing it would be noise. */
const MIN_VISIBILITY = 0.4;

export interface DrawPoseOverlayOptions {
  readonly ctx: CanvasRenderingContext2D;
  readonly skeleton: PoseSkeleton;
  readonly project: LandmarkProjector;
  /** Measured angle at the active joint, drawn as an arc plus label. */
  readonly angleDeg: number | null;
}

const isVisible = (visibility: number | undefined): boolean =>
  (visibility ?? 0) >= MIN_VISIBILITY;

const line = (
  ctx: CanvasRenderingContext2D,
  from: OverlayPoint,
  to: OverlayPoint,
  color: string,
  width: number
): void => {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
};

const dot = (
  ctx: CanvasRenderingContext2D,
  at: OverlayPoint,
  color: string,
  radius: number
): void => {
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fill();
};

const label = (
  ctx: CanvasRenderingContext2D,
  text: string,
  at: OverlayPoint
): void => {
  ctx.font = '600 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = LABEL_HALO;
  ctx.strokeText(text, at.x, at.y);
  ctx.fillStyle = ACTIVE_COLOR;
  ctx.fillText(text, at.x, at.y);
};

/**
 * Signed difference between two bearings, wrapped into `(-π, π]`, so
 * the angle arc is always drawn the short way round — the way the
 * number in the form-check panel reads it.
 */
const shortestSweep = (from: number, to: number): number => {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  return delta;
};

const drawAngle = (
  ctx: CanvasRenderingContext2D,
  proximal: OverlayPoint,
  joint: OverlayPoint,
  distal: OverlayPoint,
  angleDeg: number
): void => {
  const toProximal = Math.atan2(proximal.y - joint.y, proximal.x - joint.x);
  const toDistal = Math.atan2(distal.y - joint.y, distal.x - joint.x);
  const sweep = shortestSweep(toProximal, toDistal);

  const reach = Math.min(
    Math.hypot(proximal.x - joint.x, proximal.y - joint.y),
    Math.hypot(distal.x - joint.x, distal.y - joint.y)
  );
  const radius = Math.min(48, Math.max(14, reach * 0.35));

  ctx.beginPath();
  ctx.strokeStyle = ACTIVE_COLOR;
  ctx.lineWidth = 2;
  ctx.arc(joint.x, joint.y, radius, toProximal, toProximal + sweep, sweep < 0);
  ctx.stroke();

  const bisector = toProximal + sweep / 2;
  label(ctx, `${Math.round(angleDeg)}°`, {
    x: joint.x + Math.cos(bisector) * (radius + 18),
    y: joint.y + Math.sin(bisector) * (radius + 18),
  });
};

/**
 * Draws the detected pose over the camera frame: bones and joints in
 * white, the triplet the counter is measuring in amber, plus the angle
 * arc and its value at the active joint. Landmarks the detector is
 * unsure about are left out so a half-visible body doesn't sprout
 * lines into the corners of the frame.
 *
 * The caller owns the canvas: it clears the surface and sets up the
 * device-pixel-ratio transform, so everything here works in CSS pixels.
 */
export function drawPoseOverlay({
  ctx,
  skeleton,
  project,
  angleDeg,
}: DrawPoseOverlayOptions): void {
  const { landmarks, triplet } = skeleton;
  const active = new Set<number>(triplet);

  for (const [fromIdx, toIdx] of POSE_BONES) {
    const from = landmarks[fromIdx];
    const to = landmarks[toIdx];
    if (!from || !to) continue;
    if (!isVisible(from.visibility) || !isVisible(to.visibility)) continue;
    const isActiveBone = active.has(fromIdx) && active.has(toIdx);
    line(
      ctx,
      project(from),
      project(to),
      isActiveBone ? ACTIVE_COLOR : BONE_COLOR,
      isActiveBone ? ACTIVE_BONE_WIDTH : BONE_WIDTH
    );
  }

  const drawn = new Set<number>();
  for (const bone of POSE_BONES) {
    for (const idx of bone) {
      if (drawn.has(idx)) continue;
      drawn.add(idx);
      const landmark = landmarks[idx];
      if (!landmark || !isVisible(landmark.visibility)) continue;
      const isActiveJoint = active.has(idx);
      dot(
        ctx,
        project(landmark),
        isActiveJoint ? ACTIVE_COLOR : JOINT_COLOR,
        isActiveJoint ? ACTIVE_JOINT_RADIUS : JOINT_RADIUS
      );
    }
  }

  if (angleDeg === null) return;
  const [proximalIdx, jointIdx, distalIdx] = triplet;
  const proximal = landmarks[proximalIdx];
  const joint = landmarks[jointIdx];
  const distal = landmarks[distalIdx];
  if (!proximal || !joint || !distal) return;
  if (!isVisible(joint.visibility)) return;
  drawAngle(ctx, project(proximal), project(joint), project(distal), angleDeg);
}
