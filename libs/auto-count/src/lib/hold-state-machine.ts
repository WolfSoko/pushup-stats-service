import type { ExerciseHoldProfile } from './exercise-hold-profile';
import type { PoseSample } from './pose-sample';

export type HoldPhase = 'idle' | 'holding' | 'paused';

export interface HoldSnapshot {
  /** Total accumulated time the user has been in pose, in milliseconds. */
  readonly totalMs: number;
  readonly phase: HoldPhase;
  /**
   * Timestamp (ms) of the first sample that entered the currently
   * active holding segment. `null` while idle or paused. Useful for
   * UIs that want to show a per-segment timer alongside the running
   * total.
   */
  readonly segmentStartMs: number | null;
}

type Zone = 'in' | 'out' | 'dead';

type Candidate =
  | { readonly kind: 'enter'; sinceMs: number; lastSeenMs: number }
  | { readonly kind: 'leave'; sinceMs: number; lastSeenMs: number }
  | null;

/**
 * Pure, frame-by-frame isometric-hold detector. Counts accumulated
 * time-in-pose for exercises like plank or hollow hold. Hysteresis
 * splits each frame into one of three zones (in / out / dead) using
 * separate `inPoseAngleDeg` and `outPoseAngleDeg` thresholds, and
 * symmetric debounce windows guard against pose flicker from camera
 * noise:
 *   - entering the hold requires `minHoldMs` of in-zone samples;
 *   - leaving the hold requires `minBreakMs` of out-zone samples.
 *
 * Dead-zone samples (between the two thresholds) preserve the current
 * phase intent — they neither commit a transition nor stop accumulation
 * during an active hold — so a slow movement through the middle of the
 * range doesn't repeatedly reset the debounce candidates.
 *
 * Inter-sample gaps are credited up to `profile.maxFrameGapMs`, so a
 * dropped camera frame can't silently add seconds to the total.
 */
export class HoldStateMachine {
  private totalMs = 0;
  private phase: HoldPhase = 'idle';
  private segmentStartMs: number | null = null;
  private lastTickMs: number | null = null;
  private candidate: Candidate = null;

  constructor(private readonly profile: ExerciseHoldProfile) {}

  process(sample: PoseSample): HoldSnapshot {
    if (sample.confidence < this.profile.minConfidence) {
      return this.snapshot();
    }

    const zone = this.zoneFor(sample.angleDeg);

    if (zone === 'dead') {
      // Dead-zone samples preserve phase intent: keep accumulating
      // while holding (regardless of any pending leave candidate),
      // and leave any debounce candidate untouched. They do not on
      // their own commit or cancel a candidate transition, so an
      // active leave candidate neither advances toward `paused` nor
      // resets — the next decisive in/out sample resolves it. Without
      // accumulating here, the displayed time would freeze for the
      // duration of the leave debounce when the user briefly drifts
      // through the hysteresis dead-zone, then jump on the next in-
      // zone sample.
      if (this.phase === 'holding') {
        this.accumulate(sample.timestampMs);
      }
      return this.snapshot();
    }

    switch (this.phase) {
      case 'idle':
      case 'paused':
        if (zone === 'in') {
          this.advanceEnterCandidate(sample.timestampMs);
        } else {
          this.candidate = null;
        }
        break;
      case 'holding':
        if (zone === 'in') {
          this.candidate = null;
          this.accumulate(sample.timestampMs);
        } else {
          // Out-zone while holding: start/extend a leave candidate.
          // Do not accumulate during the candidate — the segment is
          // tentatively paused until either it confirms (→ paused)
          // or it is cancelled by a return to in-zone.
          this.advanceLeaveCandidate(sample.timestampMs);
        }
        break;
    }

    return this.snapshot();
  }

  reset(): void {
    this.totalMs = 0;
    this.phase = 'idle';
    this.segmentStartMs = null;
    this.lastTickMs = null;
    this.candidate = null;
  }

  snapshot(): HoldSnapshot {
    return {
      totalMs: this.totalMs,
      phase: this.phase,
      segmentStartMs: this.segmentStartMs,
    };
  }

  private zoneFor(angleDeg: number): Zone {
    if (angleDeg >= this.profile.inPoseAngleDeg) return 'in';
    if (angleDeg <= this.profile.outPoseAngleDeg) return 'out';
    return 'dead';
  }

  private accumulate(timestampMs: number): void {
    if (this.lastTickMs !== null) {
      const delta = Math.min(
        timestampMs - this.lastTickMs,
        this.profile.maxFrameGapMs
      );
      if (delta > 0) this.totalMs += delta;
    }
    this.lastTickMs = timestampMs;
  }

  private advanceEnterCandidate(timestampMs: number): void {
    if (
      this.candidate === null ||
      this.candidate.kind !== 'enter' ||
      timestampMs - this.candidate.lastSeenMs > this.profile.maxFrameGapMs
    ) {
      this.candidate = {
        kind: 'enter',
        sinceMs: timestampMs,
        lastSeenMs: timestampMs,
      };
    } else {
      this.candidate.lastSeenMs = timestampMs;
    }

    const dwell = this.candidate.lastSeenMs - this.candidate.sinceMs;
    if (dwell >= this.profile.minHoldMs) {
      // Back-credit the dwell window. The user has been in pose this
      // whole time; the dwell exists only because the detector needed
      // confirmation before flipping to "holding". Without this credit
      // a 1-second hold would show ~0.4s on screen, which feels wrong.
      this.phase = 'holding';
      this.segmentStartMs = this.candidate.sinceMs;
      this.totalMs += dwell;
      this.lastTickMs = timestampMs;
      this.candidate = null;
    }
  }

  private advanceLeaveCandidate(timestampMs: number): void {
    if (
      this.candidate === null ||
      this.candidate.kind !== 'leave' ||
      timestampMs - this.candidate.lastSeenMs > this.profile.maxFrameGapMs
    ) {
      this.candidate = {
        kind: 'leave',
        sinceMs: timestampMs,
        lastSeenMs: timestampMs,
      };
    } else {
      this.candidate.lastSeenMs = timestampMs;
    }

    const dwell = this.candidate.lastSeenMs - this.candidate.sinceMs;
    if (dwell >= this.profile.minBreakMs) {
      this.phase = 'paused';
      this.segmentStartMs = null;
      this.lastTickMs = null;
      this.candidate = null;
    }
  }
}
