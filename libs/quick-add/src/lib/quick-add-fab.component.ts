import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { patchState, signalState } from '@ngrx/signals';

interface DialItem {
  readonly value: number;
  readonly type: 'quick' | 'custom' | 'feedback' | 'goal';
  readonly icon: string;
}

const QUICK_ICONS = ['bolt', 'flash_on', 'whatshot'] as const;

@Component({
  selector: 'lib-quick-add-fab',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './quick-add-fab.component.html',
  styleUrl: './quick-add-fab.component.scss',
})
export class QuickAddFabComponent {
  readonly suggestions = input<number[]>([1, 5, 10]);
  readonly remainingToGoal = input<number>(0);
  readonly goalReached = input<boolean>(false);
  readonly fillToGoalInFlight = input<boolean>(false);

  readonly quickAdd = output<number>();
  readonly openDialog = output<void>();
  readonly openFeedback = output<void>();
  readonly fillToGoal = output<void>();

  protected readonly fabState = signalState({ open: false });

  protected readonly dialItems = computed<DialItem[]>(() => {
    if (!this.fabState.open()) return [];
    const quickItems: DialItem[] = this.suggestions()
      .slice(0, 3)
      .map(
        (s, i): DialItem => ({
          value: s,
          type: 'quick',
          icon: QUICK_ICONS[i] ?? 'bolt',
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

    items.push({ value: 0, type: 'custom', icon: 'edit_note' });
    items.push({ value: 0, type: 'feedback', icon: 'feedback' });

    return items;
  });

  protected readonly openAriaLabel = $localize`:@@quickAdd.fab.open:Schnellerfassung öffnen`;
  protected readonly closeAriaLabel = $localize`:@@quickAdd.fab.close:Schnellerfassung schließen`;
  protected readonly goalReachedLabel = $localize`:@@quickAdd.fab.goalReached:Ziel erreicht ✓`;
  protected readonly goalReachedAria = $localize`:@@quickAdd.fab.goalReachedAria:Tagesziel bereits erreicht`;

  protected repAriaLabel(reps: number): string {
    return $localize`:@@quickAdd.fab.repAria:${reps}:REPS: Liegestütze hinzufügen`;
  }

  protected fillToGoalAria(gap: number): string {
    return $localize`:@@quickAdd.fab.fillToGoalAria:${gap}:GAP: Liegestütze bis zum Tagesziel hinzufügen`;
  }

  protected goalDisabled(): boolean {
    return this.goalReached() || this.fillToGoalInFlight();
  }

  protected toggle(): void {
    patchState(this.fabState, { open: !this.fabState.open() });
  }

  protected onQuickAdd(reps: number): void {
    patchState(this.fabState, { open: false });
    this.quickAdd.emit(reps);
  }

  protected onOpenDialog(): void {
    patchState(this.fabState, { open: false });
    this.openDialog.emit();
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
