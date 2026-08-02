import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
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

/**
 * One daily goal in the speed dial's goal submenu. The FAB stays
 * presentation-only: producers localise the label and decide whether a
 * goal can be closed with one tap, the id round-trips back through
 * `fillGoalItem`.
 */
export interface QuickAddGoalItem {
  readonly id: string;
  readonly label: string;
  readonly ariaLabel: string;
  readonly reached: boolean;
  readonly disabled: boolean;
}

interface DialItem {
  readonly value: number;
  readonly type:
    'quick' | 'custom' | 'feedback' | 'goal' | 'auto-count' | 'exercise-timer';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './quick-add-fab.component.scss',
})
export class QuickAddFabComponent {
  readonly suggestions = input<QuickAddSuggestion[]>([]);
  readonly remainingToGoal = input<number>(0);
  readonly goalReached = input<boolean>(false);
  readonly fillToGoalInFlight = input<boolean>(false);
  readonly autoCountEnabled = input<boolean>(false);
  /**
   * Today's daily goals. With more than one the goal dial entry becomes a
   * submenu — a single "bis zum Ziel" button can only ever fill one of
   * them, which would silently pick a goal for the user.
   */
  readonly goalItems = input<QuickAddGoalItem[]>([]);

  readonly quickAdd = output<QuickAddSuggestion>();
  readonly openDialog = output<void>();
  readonly openFeedback = output<void>();
  readonly fillToGoal = output<void>();
  /** Id of the goal the user picked from the submenu. */
  readonly fillGoalItem = output<string>();
  readonly openAutoCount = output<void>();
  readonly openExerciseTimer = output<void>();
  readonly opened = output<void>();

  protected readonly fabState = signalState({ open: false, goalMenu: false });

  protected readonly hasGoalSubmenu = computed(
    () => this.goalItems().length > 1
  );

  protected readonly dialItems = computed<DialItem[]>(() => {
    if (!this.fabState.open()) return [];
    const quickItems: DialItem[] = this.suggestions()
      .slice(0, 3)
      .map((s): DialItem => ({
        value: s.reps,
        type: 'quick',
        label: s.label,
        ariaLabel: s.ariaLabel,
        suggestion: s,
      }));

    const items: DialItem[] = [...quickItems];

    const remaining = this.remainingToGoal();
    const reached = this.goalReached();
    // With a submenu the dial entry stays even when the pushup-based
    // `remainingToGoal` is 0 — the other goals of the day may still be open.
    if (this.hasGoalSubmenu() || remaining > 0 || reached) {
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

  protected readonly goalsLabel = $localize`:@@quickAdd.fab.goals:Tagesziele`;
  protected readonly goalsAria = $localize`:@@quickAdd.fab.goalsAria:Tagesziele zum Abhaken anzeigen`;

  protected toggle(): void {
    const nextOpen = !this.fabState.open();
    patchState(this.fabState, { open: nextOpen, goalMenu: false });
    if (nextOpen) this.opened.emit();
  }

  protected toggleGoalMenu(): void {
    patchState(this.fabState, { goalMenu: !this.fabState.goalMenu() });
  }

  protected onFillGoalItem(goal: QuickAddGoalItem): void {
    if (goal.disabled) return;
    patchState(this.fabState, { open: false, goalMenu: false });
    this.fillGoalItem.emit(goal.id);
  }

  protected onQuickAdd(suggestion: QuickAddSuggestion): void {
    patchState(this.fabState, { open: false, goalMenu: false });
    this.quickAdd.emit(suggestion);
  }

  protected onOpenDialog(): void {
    patchState(this.fabState, { open: false, goalMenu: false });
    this.openDialog.emit();
  }

  protected onOpenAutoCount(): void {
    patchState(this.fabState, { open: false, goalMenu: false });
    this.openAutoCount.emit();
  }

  protected onOpenExerciseTimer(): void {
    patchState(this.fabState, { open: false, goalMenu: false });
    this.openExerciseTimer.emit();
  }

  protected onOpenFeedback(): void {
    patchState(this.fabState, { open: false, goalMenu: false });
    this.openFeedback.emit();
  }

  protected onFillToGoal(): void {
    if (this.goalDisabled()) return;
    patchState(this.fabState, { open: false, goalMenu: false });
    this.fillToGoal.emit();
  }
}
