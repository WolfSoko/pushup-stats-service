export interface PoseSample {
  /** Joint angle in degrees, as defined by the active `ExerciseAngleProfile`. */
  readonly angleDeg: number;
  /** Detector confidence in `[0, 1]`. Sub-threshold samples are dropped. */
  readonly confidence: number;
  /** Monotonic timestamp in milliseconds (e.g. `performance.now()`). */
  readonly timestampMs: number;
}
