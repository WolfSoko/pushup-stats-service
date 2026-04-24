import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MAX_QUICK_ADDS, QuickAddConfig } from '@pu-stats/models';
import { UserConfigStore } from '../../../core/user-config.store';

interface DraftRow {
  reps: number | null;
  inSpeedDial: boolean;
}

@Component({
  selector: 'app-quick-add-config-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@quickAddConfig.title">
      Schnellaktionen konfigurieren
    </h2>
    <mat-dialog-content class="content">
      <p class="hint" i18n="@@quickAddConfig.hint">
        Lege bis zu {{ maxRows }} eigene Reps-Buttons fest. Leere Felder werden
        ignoriert.
      </p>
      @for (row of rows(); track $index) {
        <div class="row" [attr.data-testid]="'quick-add-row-' + $index">
          <mat-form-field appearance="outline" class="reps-field">
            <mat-label i18n="@@quickAddConfig.repsLabel">Reps</mat-label>
            <input
              matInput
              type="number"
              min="1"
              inputmode="numeric"
              [value]="row.reps ?? ''"
              (input)="setReps($index, $event)"
            />
          </mat-form-field>
          <mat-checkbox
            [checked]="row.inSpeedDial"
            (change)="setInSpeedDial($index, $event.checked)"
            [attr.data-testid]="'quick-add-speeddial-' + $index"
            i18n="@@quickAddConfig.inSpeedDial"
            >Im SpeedDial</mat-checkbox
          >
          <button
            type="button"
            mat-icon-button
            (click)="clearRow($index)"
            [attr.aria-label]="clearAria"
            i18n-aria-label="@@quickAddConfig.clearAria"
          >
            <mat-icon>backspace</mat-icon>
          </button>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close i18n="@@cancel">Abbrechen</button>
      <button
        mat-flat-button
        type="button"
        data-testid="quick-add-config-save"
        [disabled]="saving()"
        (click)="save()"
        i18n="@@save"
      >
        Speichern
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .content {
      display: grid;
      gap: 10px;
      min-width: min(92vw, 420px);
    }
    .hint {
      margin: 0;
      opacity: 0.8;
      font-size: 0.9rem;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .reps-field {
      flex: 1;
    }
  `,
})
export class QuickAddConfigDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<QuickAddConfigDialogComponent>
  );
  private readonly userConfig = inject(UserConfigStore);

  protected readonly maxRows = MAX_QUICK_ADDS;
  protected readonly clearAria = $localize`:@@quickAddConfig.clearAria:Reps löschen`;
  protected readonly saving = signal(false);

  private readonly initialRows: DraftRow[] = ((): DraftRow[] => {
    const configured = this.userConfig.quickAdds();
    return Array.from({ length: MAX_QUICK_ADDS }, (_, i) => ({
      reps: configured[i]?.reps ?? null,
      inSpeedDial: configured[i]?.inSpeedDial ?? false,
    }));
  })();

  private readonly rowsState = signal<DraftRow[]>(this.initialRows);
  protected readonly rows = computed(() => this.rowsState());

  protected setReps(index: number, ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value;
    const n = raw === '' ? null : Number(raw);
    const next = [...this.rowsState()];
    next[index] = {
      ...next[index],
      reps: n === null || Number.isNaN(n) ? null : Math.max(1, Math.trunc(n)),
    };
    this.rowsState.set(next);
  }

  protected setInSpeedDial(index: number, checked: boolean): void {
    const next = [...this.rowsState()];
    next[index] = { ...next[index], inSpeedDial: checked };
    this.rowsState.set(next);
  }

  protected clearRow(index: number): void {
    const next = [...this.rowsState()];
    next[index] = { reps: null, inSpeedDial: false };
    this.rowsState.set(next);
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const quickAdds: QuickAddConfig[] = this.rowsState()
      .filter(
        (r): r is DraftRow & { reps: number } => r.reps !== null && r.reps > 0
      )
      .map((r) => ({ reps: r.reps, inSpeedDial: r.inSpeedDial }));

    try {
      const currentUi = this.userConfig.config()?.ui ?? {};
      await this.userConfig.save({
        ui: { ...currentUi, quickAdds },
      });
      this.dialogRef.close(quickAdds);
    } catch {
      this.saving.set(false);
    }
  }
}
