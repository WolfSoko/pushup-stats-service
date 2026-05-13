export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/**
 * Angle (degrees) at the elbow joint, given the surrounding triplet
 * (shoulder, elbow, wrist). Returns NaN if any segment is degenerate
 * (zero-length) — the state machine drops such samples via its
 * confidence floor, so we don't need to invent a fallback value.
 *
 * Pose-Landmarker coords are normalized in [0, 1]; the angle is
 * scale-invariant so 2D vs 3D doesn't matter for this calculation.
 */
export function angleAtElbowDeg(
  shoulder: Point2D,
  elbow: Point2D,
  wrist: Point2D
): number {
  const ax = shoulder.x - elbow.x;
  const ay = shoulder.y - elbow.y;
  const bx = wrist.x - elbow.x;
  const by = wrist.y - elbow.y;
  const magA = Math.hypot(ax, ay);
  const magB = Math.hypot(bx, by);
  if (magA === 0 || magB === 0) return Number.NaN;
  const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (magA * magB)));
  return (Math.acos(cos) * 180) / Math.PI;
}
