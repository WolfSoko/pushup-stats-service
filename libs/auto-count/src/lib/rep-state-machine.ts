import type { ExerciseAngleProfile } from './exercise-angle-profile';
import type { PoseSample } from './pose-sample';

export type RepPhase = 'awaiting-up' | 'up' | 'down';

export interface RepCountSnapshot {
  readonly count: number;
  readonly phase: RepPhase;
  readonly lastRepAtMs: number | null;
}

export interface RepProcessResult {
  readonly snapshot: RepCountSnapshot;
  readonly repJustHappened: boolean;
}

type CandidatePhase = { phase: 'up' | 'down'; sinceMs: number } | null;

/**
 * Pure, frame-by-frame rep detector. Counts a rep on each confirmed
 * `down -> up` transition. Confirmation requires the candidate phase to
 * persist for at least `profile.minDwellMs`, so single-frame noise blips
 * across a threshold cannot trigger a count.
 *
 * Dead-zone samples (between `downAngleDeg` and `upAngleDeg`) do not reset
 * the current candidate — they just don't advance it. This keeps the
 * detector tolerant of slow transitions while still rejecting jitter.
 */
export class RepStateMachine {
  private count = 0;
  private phase: RepPhase = 'awaiting-up';
  private lastRepAtMs: number | null = null;
  private candidate: CandidatePhase = null;

  constructor(private readonly profile: ExerciseAngleProfile) {}

  process(sample: PoseSample): RepProcessResult {
    if (sample.confidence < this.profile.minConfidence) {
      return { snapshot: this.snapshot(), repJustHappened: false };
    }

    const zone = this.zoneFor(sample.angleDeg);
    if (zone === null) {
      return { snapshot: this.snapshot(), repJustHappened: false };
    }

    if (zone === this.phase) {
      this.candidate = null;
      return { snapshot: this.snapshot(), repJustHappened: false };
    }

    if (this.candidate === null || this.candidate.phase !== zone) {
      this.candidate = { phase: zone, sinceMs: sample.timestampMs };
      return { snapshot: this.snapshot(), repJustHappened: false };
    }

    const dwell = sample.timestampMs - this.candidate.sinceMs;
    if (dwell < this.profile.minDwellMs) {
      return { snapshot: this.snapshot(), repJustHappened: false };
    }

    const previous = this.phase;
    const next = this.candidate.phase;
    this.phase = next;
    this.candidate = null;

    const repHappened = previous === 'down' && next === 'up';
    if (repHappened) {
      this.count += 1;
      this.lastRepAtMs = sample.timestampMs;
    }

    return { snapshot: this.snapshot(), repJustHappened: repHappened };
  }

  reset(): void {
    this.count = 0;
    this.phase = 'awaiting-up';
    this.lastRepAtMs = null;
    this.candidate = null;
  }

  snapshot(): RepCountSnapshot {
    return {
      count: this.count,
      phase: this.phase,
      lastRepAtMs: this.lastRepAtMs,
    };
  }

  private zoneFor(angleDeg: number): 'up' | 'down' | null {
    if (angleDeg >= this.profile.upAngleDeg) return 'up';
    if (angleDeg <= this.profile.downAngleDeg) return 'down';
    return null;
  }
}
