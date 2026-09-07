import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DayTestField } from './training-plan-detail.models';

/** One measured value the user submitted. */
export interface TestResultSubmit {
  itemIndex: number;
  value: number;
}

/**
 * The result form of a max-test day.
 *
 * Every other plan day prescribes its numbers; a test day asks for them.
 * A day can measure several things at once — Core Foundations opens with
 * a max plank hold, ten pushups and a max hollow hold — so there is one
 * row per measurable exercise, each in its own unit.
 *
 * Purely presentational — the parent owns the store writes.
 */
@Component({
  selector: 'app-plan-test-input',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-test-input.component.html',
  styleUrl: './plan-test-input.component.css',
})
export class PlanTestInputComponent {
  readonly fields = input.required<ReadonlyArray<DayTestField>>();
  /**
   * True for the plan's opening test — the one whose results rescale the
   * days after it. A closing test only records where the user landed.
   */
  readonly scalesPlan = input(false);
  /** False for future days and inactive plans — the form stays read-only. */
  readonly interactive = input(false);

  readonly submitResult = output<TestResultSubmit>();
  readonly clearResult = output<number>();

  /** Re-seeds from the stored values, so a revision starts from them. */
  private readonly drafts = linkedSignal<
    ReadonlyArray<DayTestField>,
    ReadonlyMap<number, string>
  >({
    source: this.fields,
    computation: (fields) =>
      new Map(
        fields.map((f) => [f.itemIndex, f.result === null ? '' : `${f.result}`])
      ),
  });

  private readonly touched = signal<ReadonlySet<number>>(new Set());

  protected draftFor(itemIndex: number): string {
    return this.drafts().get(itemIndex) ?? '';
  }

  private parsed(itemIndex: number): number | null {
    const raw = this.draftFor(itemIndex).trim();
    if (raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  protected isValid(field: DayTestField): boolean {
    const value = this.parsed(field.itemIndex);
    return (
      value !== null &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= field.max
    );
  }

  protected showError(field: DayTestField): boolean {
    return (
      this.touched().has(field.itemIndex) &&
      this.draftFor(field.itemIndex).trim() !== '' &&
      !this.isValid(field)
    );
  }

  /** True once every field of the day carries a recorded value. */
  protected readonly allRecorded = computed(() =>
    this.fields().every((f) => f.result !== null)
  );

  /** Fields whose value actually moved the plan, for the effect summary. */
  protected readonly scaled = computed(() =>
    this.fields().filter((f) => f.result !== null && f.percent !== null)
  );

  protected readonly clearTooltip = $localize`:@@trainingPlans.test.clear:Wert verwerfen`;

  protected onInput(itemIndex: number, value: string): void {
    this.drafts.update((map) => new Map(map).set(itemIndex, value));
    this.touched.update((set) => new Set(set).add(itemIndex));
  }

  protected submit(field: DayTestField): void {
    this.touched.update((set) => new Set(set).add(field.itemIndex));
    if (!this.isValid(field)) return;
    const value = this.parsed(field.itemIndex);
    if (value === null) return;
    this.submitResult.emit({ itemIndex: field.itemIndex, value });
  }
}
