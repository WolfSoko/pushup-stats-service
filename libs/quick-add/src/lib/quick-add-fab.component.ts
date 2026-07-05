import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { patchState, signalState } from '@ngrx/signals';

/**
 * Pre-resolved quick-add the speed dial should render. Producers
 * (e.g. `AppDataFacade.quickAddSuggestions`) localise the label so the
 * FAB stays presentation-only.
 * `exerciseId` is opaque to the FAB — it round-trips back through the
 * `quickAdd` output so the dispatcher can pick the right write target.
 */
export interface QuickAddSuggestion {
  readonly key: string;
  readonly reps: number;
  readonly label: string;
  readonly ariaLabel: string;
  readonly exerciseId: string;
}

interface DialItem {
  readonly value: number;
  readonly type:
    | 'quick'
    | 'custom'
    | 'feedback'
    | 'goal'
    | 'auto-count'
    | 'exercise-timer';
  /** Functional glyph for the fixed dial items; quick-add items render label-only. */
  readonly icon?: string;
  readonly label?: string;
  readonly ariaLabel?: string;
  readonly suggestion?: QuickAddSuggestion;
}

@Component({
  selector: 'lib-quick-add-fab',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './quick-add-fab.component.html',
  styleUrl: './quick-add-fab.component.scss',
})
export class QuickAddFabComponent {
  readonly suggestions = input<QuickAddSuggestion[]>([]);
  readonly remainingToGoal = input<number>(0);
  readonly goalReached = input<boolean>(false);
  readonly fillToGoalInFlight = input<boolean>(false);
  readonly autoCountEnabled = input<boolean>(false);

  readonly quickAdd = output<QuickAddSuggestion>();
  readonly openDialog = output<void>();
  readonly openFeedback = output<void>();
  readonly fillToGoal = output<void>();
  readonly openAutoCount = output<void>();
  readonly openExerciseTimer = output<void>();
  readonly opened = output<void>();

  protected readonly fabState = signalState({ open: false });

  protected readonly dialItems = computed<DialItem[]>(() => {
    if (!this.fabState.open()) return [];
    const quickItems: DialItem[] = this.suggestions()
      .slice(0, 3)
      .map(
        (s): DialItem => ({
          value: s.reps,
          type: 'quick',
          label: s.label,
          ariaLabel: s.ariaLabel,
          suggestion: s,
        })
      );

    const items: DialItem[] = [...quickItems];

    const remaining = this.remainingToGoal();
    const reached = this.goalReached();
    if (remaining > 0 || reached) {
      items.push({
        value: remaining,
        type: 'goal',
        icon: reached ? 'check' : 'flag',
      });
    }

    if (this.autoCountEnabled()) {
      items.push({ value: 0, type: 'auto-count', icon: 'videocam' });
    }
    items.push({ value: 0, type: 'exercise-timer', icon: 'timer' });
    items.push({ value: 0, type: 'custom', icon: 'edit_note' });
    items.push({ value: 0, type: 'feedback', icon: 'feedback' });

    return items;
  });

  protected readonly openAriaLabel = $localize`:@@quickAdd.fab.open:Schnellerfassung öffnen`;
  protected readonly closeAriaLabel = $localize`:@@quickAdd.fab.close:Schnellerfassung schließen`;
  protected readonly goalReachedLabel = $localize`:@@quickAdd.fab.goalReached:Ziel erreicht ✓`;
  protected readonly goalReachedAria = $localize`:@@quickAdd.fab.goalReachedAria:Tagesziel bereits erreicht`;

  protected fillToGoalAria(gap: number): string {
    return $localize`:@@quickAdd.fab.fillToGoalAria:${gap}:GAP: Liegestütze bis zum Tagesziel hinzufügen`;
  }

  protected goalDisabled(): boolean {
    return this.goalReached() || this.fillToGoalInFlight();
  }

  protected toggle(): void {
    const nextOpen = !this.fabState.open();
    patchState(this.fabState, { open: nextOpen });
    if (nextOpen) this.opened.emit();
  }

  protected onQuickAdd(suggestion: QuickAddSuggestion): void {
    patchState(this.fabState, { open: false });
    this.quickAdd.emit(suggestion);
  }

  protected onOpenDialog(): void {
    patchState(this.fabState, { open: false });
    this.openDialog.emit();
  }

  protected onOpenAutoCount(): void {
    patchState(this.fabState, { open: false });
    this.openAutoCount.emit();
  }

  protected onOpenExerciseTimer(): void {
    patchState(this.fabState, { open: false });
    this.openExerciseTimer.emit();
  }

  protected onOpenFeedback(): void {
    patchState(this.fabState, { open: false });
    this.openFeedback.emit();
  }

  protected onFillToGoal(): void {
    if (this.goalDisabled()) return;
    patchState(this.fabState, { open: false });
    this.fillToGoal.emit();
  }
}
