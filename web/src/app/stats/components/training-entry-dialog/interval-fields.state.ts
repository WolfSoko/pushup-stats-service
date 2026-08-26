import { computed, signal } from '@angular/core';
import {
  formatKmInput,
  parseDurationFromParts,
  parseKmToMeters,
  splitDurationParts,
} from './training-entry-dialog.helpers';
import { appendEntry, removeEntry } from './training-entry-dialog.submit';

export type IntervalKind = 'duration' | 'distance';

/**
 * Per-interval endurance breakdown, entered with the same field shape as
 * the exercise's main measurement — mm:ss for `time`, km for `distance` /
 * `distance-time` — instead of a bare number whose unit isn't obvious.
 * `kind` is a callback because it tracks the parent's current measurement,
 * which can change when the picker switches exercise.
 */
export class IntervalFieldsState {
  // Both are callbacks: `kind` because it tracks the parent's measurement,
  // `locale` because the field initializer that constructs this class runs
  // before the owning class's own constructor-parameter properties (like
  // `locale`) are assigned — see the call site.
  constructor(
    private readonly kind: () => IntervalKind,
    private readonly locale: () => string
  ) {}

  readonly minutesInputs = signal<string[]>(['']);
  readonly secondsInputs = signal<string[]>(['']);
  readonly distanceInputs = signal<string[]>(['']);

  readonly rowCount = computed(() =>
    this.kind() === 'duration'
      ? this.minutesInputs().length
      : this.distanceInputs().length
  );
  readonly indexes = computed(() =>
    Array.from({ length: this.rowCount() }, (_, i) => i)
  );
  readonly values = computed<number[]>(() =>
    this.kind() === 'duration'
      ? this.minutesInputs().map(
          (m, i) =>
            parseDurationFromParts(m, this.secondsInputs()[i] ?? '') ?? 0
        )
      : this.distanceInputs().map((d) => parseKmToMeters(d) ?? 0)
  );

  reset(): void {
    this.minutesInputs.set(['']);
    this.secondsInputs.set(['']);
    this.distanceInputs.set(['']);
  }

  seed(raw: ReadonlyArray<number>): void {
    if (this.kind() === 'duration') {
      const parts = raw.map((v) => splitDurationParts(v));
      this.minutesInputs.set(parts.map((p) => p.minutes));
      this.secondsInputs.set(parts.map((p) => p.seconds));
      return;
    }
    this.distanceInputs.set(raw.map((v) => formatKmInput(v, this.locale())));
  }

  add(): void {
    if (this.kind() === 'duration') {
      this.minutesInputs.update((s) => appendEntry(s, ''));
      this.secondsInputs.update((s) => appendEntry(s, ''));
      return;
    }
    this.distanceInputs.update((s) => appendEntry(s, ''));
  }

  remove(index: number): void {
    if (this.kind() === 'duration') {
      this.minutesInputs.update((s) => removeEntry(s, index, ''));
      this.secondsInputs.update((s) => removeEntry(s, index, ''));
      return;
    }
    this.distanceInputs.update((s) => removeEntry(s, index, ''));
  }

  updateMinutes(index: number, value: string): void {
    this.minutesInputs.update((s) =>
      s.map((v, i) => (i === index ? value : v))
    );
  }
  updateSeconds(index: number, value: string): void {
    this.secondsInputs.update((s) =>
      s.map((v, i) => (i === index ? value : v))
    );
  }
  updateDistance(index: number, value: string): void {
    this.distanceInputs.update((s) =>
      s.map((v, i) => (i === index ? value : v))
    );
  }
}
