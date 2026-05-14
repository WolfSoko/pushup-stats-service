export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/**
 * Angle (degrees) at a joint, given the surrounding triplet
 * `(proximal, joint, distal)`. Works for any body joint — elbow
 * (shoulder/elbow/wrist), knee (hip/knee/ankle), hip
 * (shoulder/hip/knee), etc.
 *
 * Returns NaN if either segment is degenerate (zero-length); callers
 * must filter such results — `poseToAngleSample` drops them via
 * `Number.isNaN(angleDeg)` so they never reach the rep state machine.
 *
 * Pose-Landmarker coords are normalized in [0, 1]; the angle is
 * scale-invariant so 2D vs 3D doesn't matter for this calculation.
 */
export function angleAtJointDeg(
  proximal: Point2D,
  joint: Point2D,
  distal: Point2D
): number {
  const ax = proximal.x - joint.x;
  const ay = proximal.y - joint.y;
  const bx = distal.x - joint.x;
  const by = distal.y - joint.y;
  const magA = Math.hypot(ax, ay);
  const magB = Math.hypot(bx, by);
  if (magA === 0 || magB === 0) return Number.NaN;
  const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (magA * magB)));
  return (Math.acos(cos) * 180) / Math.PI;
}
