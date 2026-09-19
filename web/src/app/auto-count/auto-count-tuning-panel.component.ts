import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';

import {
  paramsFor,
  type TuningKind,
  type TuningParam,
} from './auto-count-tuning.models';
import { AutoCountTuningStore } from './auto-count-tuning.store';

/**
 * Admin-only panel for dialling in a detector profile against the live
 * camera. Every slider move applies immediately (the host restarts the
 * detector), so the effect is visible in the same set it is made in;
 * saving persists it, publishing rolls it out beyond admins.
 */
@Component({
  selector: 'app-auto-count-tuning-panel',
  standalone: true,
  imports: [
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatSliderModule,
    MatSlideToggleModule,
  ],
  templateUrl: './auto-count-tuning-panel.component.html',
  styleUrl: './auto-count-tuning-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoCountTuningPanelComponent {
  readonly exerciseId = input.required<string>();
  readonly kind = input.required<TuningKind>();
  /** Catalog values, shown as the baseline each slider starts from. */
  readonly defaults = input.required<Readonly<Record<string, number>>>();
  /** Emitted after any change that requires the detector to restart. */
  readonly changed = output<void>();

  protected readonly store = inject(AutoCountTuningStore);
  protected readonly params = computed<ReadonlyArray<TuningParam>>(() =>
    paramsFor(this.kind())
  );
  protected readonly saving = signal(false);
  protected readonly published = computed(() =>
    this.store.publishedFor(this.exerciseId())
  );
  protected readonly dirty = computed(() =>
    this.store.hasDraft(this.exerciseId())
  );

  /** The slider's current position: the override if set, else the default. */
  protected valueOf(param: TuningParam): number {
    const tuned = this.store.valuesFor(this.exerciseId())[param.key];
    return tuned ?? this.defaults()[param.key] ?? param.min;
  }

  protected isOverridden(param: TuningParam): boolean {
    return this.store.valuesFor(this.exerciseId())[param.key] !== undefined;
  }

  protected onInput(param: TuningParam, value: number): void {
    this.store.setValue(this.exerciseId(), this.kind(), param.key, value);
    this.changed.emit();
  }

  protected onClear(param: TuningParam): void {
    this.store.clearValue(this.exerciseId(), this.kind(), param.key);
    this.changed.emit();
  }

  protected onResetAll(): void {
    this.store.resetToDefaults(this.exerciseId());
    this.changed.emit();
  }

  protected onDiscard(): void {
    this.store.discardDraft(this.exerciseId());
    this.changed.emit();
  }

  /** Persists without touching the rollout state — see the template. */
  protected async onSaveKeepingRollout(): Promise<void> {
    await this.onSave(this.published());
  }

  protected async onSave(published: boolean): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.store.save(this.exerciseId(), this.kind(), published);
    } catch {
      // Surfaced through store.error(); the panel stays open so the
      // tuned values are not lost to a failed write.
    } finally {
      this.saving.set(false);
    }
  }
}
