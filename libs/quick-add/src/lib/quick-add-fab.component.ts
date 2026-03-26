import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { patchState, signalState } from '@ngrx/signals';

interface DialItem {
  readonly value: number;
  readonly type: 'quick' | 'custom';
}

@Component({
  selector: 'lib-quick-add-fab',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './quick-add-fab.component.html',
  styleUrl: './quick-add-fab.component.scss',
})
export class QuickAddFabComponent {
  readonly suggestions = input<number[]>([1, 5, 10]);

  readonly quickAdd = output<number>();
  readonly openDialog = output<void>();

  protected readonly fabState = signalState({ open: false });

  protected readonly dialItems = computed<DialItem[]>(() => {
    if (!this.fabState.open()) return [];
    return [
      ...this.suggestions().map((s): DialItem => ({ value: s, type: 'quick' })),
      { value: 0, type: 'custom' },
    ];
  });

  protected readonly openAriaLabel = $localize`:@@quickAdd.fab.open:Schnellerfassung öffnen`;
  protected readonly closeAriaLabel = $localize`:@@quickAdd.fab.close:Schnellerfassung schließen`;

  protected repAriaLabel(reps: number): string {
    return $localize`:@@quickAdd.fab.repAria:${reps}:REPS: Liegestütze hinzufügen`;
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
}
