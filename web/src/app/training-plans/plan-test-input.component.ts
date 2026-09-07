import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { isValidTestResult, MAX_TEST_REPS } from '@pu-stats/models';

/**
 * The result field of a max-test day.
 *
 * Every other plan day prescribes its numbers; a test day asks for one.
 * Without this field the opening test of a plan is a day whose
 * description tells the user to record a baseline and whose UI offers
 * nowhere to put it — and on the plans whose test prescribes no figure
 * at all, nothing rendered whatsoever.
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
  /** The result already recorded for this test day, if any. */
  readonly result = input<number | null>(null);
  /** The day's own recommended figure; 0 when it prescribes none. */
  readonly recommended = input(0);
  /**
   * True for the plan's opening test — the one whose result rescales the
   * days after it. A closing test only records where the user landed.
   */
  readonly scalesPlan = input(false);
  /** The scale factor currently in force, for the "what this did" hint. */
  readonly factor = input(1);
  /** False for future days and inactive plans — the field stays read-only. */
  readonly interactive = input(false);

  readonly submitResult = output<number>();
  readonly clearResult = output<void>();

  protected readonly maxReps = MAX_TEST_REPS;

  /** Re-seeds from the stored result, so a revision starts from it. */
  protected readonly draft = linkedSignal(() => {
    const current = this.result();
    return current === null ? '' : String(current);
  });

  protected readonly touched = linkedSignal(() => {
    this.result();
    return false;
  });

  protected readonly parsed = computed(() => {
    const raw = this.draft().trim();
    if (raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  });

  protected readonly valid = computed(() => {
    const value = this.parsed();
    return value !== null && isValidTestResult(value);
  });

  protected readonly showError = computed(
    () => this.touched() && this.draft().trim() !== '' && !this.valid()
  );

  /** The user's result as a percentage of what the plan was written for. */
  protected readonly percent = computed(() => Math.round(this.factor() * 100));

  protected readonly clearTooltip = $localize`:@@trainingPlans.test.clear:Ergebnis verwerfen`;

  protected onInput(value: string): void {
    this.draft.set(value);
    this.touched.set(true);
  }

  protected submit(): void {
    this.touched.set(true);
    const value = this.parsed();
    if (value === null || !isValidTestResult(value)) return;
    this.submitResult.emit(value);
  }
}
