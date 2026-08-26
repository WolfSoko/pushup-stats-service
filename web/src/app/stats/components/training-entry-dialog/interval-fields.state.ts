import { computed, signal } from '@angular/core';
import {
  formatKmInput,
  parseDurationFromParts,
  parseKmToMeters,
  splitDurationParts,
} from './training-entry-dialog.helpers';
import { appendEntry, removeEntry } from './training-entry-dialog.submit';

export type IntervalKind = 'duration' | 'distance';

interface IntervalRow {
  minutes: string;
  seconds: string;
  distance: string;
  // Split-time companion, only rendered/used for `distance-time` intervals
  // (a distance row's primary value is the distance; the split time is an
  // optional second field alongside it, mirroring the main entry's
  // Distanz+Minuten/Sekunden pair).
  companionMinutes: string;
  companionSeconds: string;
}

const EMPTY_ROW: IntervalRow = {
  minutes: '',
  seconds: '',
  distance: '',
  companionMinutes: '',
  companionSeconds: '',
};

/**
 * Per-interval endurance breakdown, entered with the same field shape as
 * the exercise's main measurement — mm:ss for `time`, km (+ an optional
 * mm:ss split time for `distance-time`) for `distance` — instead of a bare
 * number whose unit isn't obvious. `kind`/`hasDurationCompanion` are
 * callbacks because they track the parent's current measurement, which can
 * change when the picker switches exercise.
 */
export class IntervalFieldsState {
  // `locale` is a callback for the same reason as `kind`: the field
  // initializer that constructs this class runs before the owning class's
  // own constructor-parameter properties (like `locale`) are assigned —
  // see the call site.
  constructor(
    private readonly kind: () => IntervalKind,
    private readonly hasDurationCompanion: () => boolean,
    private readonly locale: () => string
  ) {}

  private readonly rows = signal<IntervalRow[]>([{ ...EMPTY_ROW }]);

  readonly rowCount = computed(() => this.rows().length);
  readonly indexes = computed(() => this.rows().map((_, i) => i));
  readonly minutesInputs = computed(() => this.rows().map((r) => r.minutes));
  readonly secondsInputs = computed(() => this.rows().map((r) => r.seconds));
  readonly distanceInputs = computed(() => this.rows().map((r) => r.distance));
  readonly companionMinutesInputs = computed(() =>
    this.rows().map((r) => r.companionMinutes)
  );
  readonly companionSecondsInputs = computed(() =>
    this.rows().map((r) => r.companionSeconds)
  );

  readonly values = computed<number[]>(() =>
    this.kind() === 'duration'
      ? this.rows().map(
          (r) => parseDurationFromParts(r.minutes, r.seconds) ?? 0
        )
      : this.rows().map((r) => parseKmToMeters(r.distance) ?? 0)
  );

  /** `[]` when this measurement has no split-time companion. */
  readonly companionValues = computed<number[]>(() =>
    this.hasDurationCompanion()
      ? this.rows().map(
          (r) =>
            parseDurationFromParts(r.companionMinutes, r.companionSeconds) ?? 0
        )
      : []
  );

  reset(): void {
    this.rows.set([{ ...EMPTY_ROW }]);
  }

  seed(raw: ReadonlyArray<number>, companionRaw: ReadonlyArray<number>): void {
    if (raw.length === 0) {
      this.reset();
      return;
    }
    const hasCompanion = this.hasDurationCompanion();
    const duration = this.kind() === 'duration';
    this.rows.set(
      raw.map((v, i) => {
        const row = { ...EMPTY_ROW };
        if (duration) {
          const parts = splitDurationParts(v);
          row.minutes = parts.minutes;
          row.seconds = parts.seconds;
        } else {
          row.distance = formatKmInput(v, this.locale());
        }
        if (hasCompanion && companionRaw[i]) {
          const parts = splitDurationParts(companionRaw[i]);
          row.companionMinutes = parts.minutes;
          row.companionSeconds = parts.seconds;
        }
        return row;
      })
    );
  }

  add(): void {
    this.rows.update((rs) => appendEntry(rs, { ...EMPTY_ROW }));
  }

  remove(index: number): void {
    this.rows.update((rs) => removeEntry(rs, index, { ...EMPTY_ROW }));
  }

  private updateField(
    index: number,
    field: keyof IntervalRow,
    value: string
  ): void {
    this.rows.update((rs) =>
      rs.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  updateMinutes(index: number, value: string): void {
    this.updateField(index, 'minutes', value);
  }
  updateSeconds(index: number, value: string): void {
    this.updateField(index, 'seconds', value);
  }
  updateDistance(index: number, value: string): void {
    this.updateField(index, 'distance', value);
  }
  updateCompanionMinutes(index: number, value: string): void {
    this.updateField(index, 'companionMinutes', value);
  }
  updateCompanionSeconds(index: number, value: string): void {
    this.updateField(index, 'companionSeconds', value);
  }
}
