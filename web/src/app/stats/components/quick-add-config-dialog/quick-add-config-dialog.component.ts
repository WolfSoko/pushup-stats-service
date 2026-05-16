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
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  EXERCISE_CATALOG,
  isAutoCountQuickAddExerciseId,
  MAX_QUICK_ADDS,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  QuickAddConfig,
  QuickAddMode,
} from '@pu-stats/models';
import { exerciseDisplayName } from '../../i18n/exercise-display-names';
import { UserConfigStore } from '../../../core/user-config.store';

interface DraftRow {
  reps: number | null;
  inSpeedDial: boolean;
  exerciseId: string;
  mode: QuickAddMode;
}

interface ExerciseOption {
  readonly id: string;
  readonly label: string;
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
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@quickAddConfig.title">
      Schnellaktionen konfigurieren
    </h2>
    <mat-dialog-content class="content">
      <p class="hint" i18n="@@quickAddConfig.hintV2">
        Lege bis zu {{ maxRows }} Schnellaktionen fest. Wähle pro Button die
        Übung und – wo verfügbar – Auto-Messung über die Kamera. Leere Felder
        werden ignoriert.
      </p>
      @for (row of rows(); track $index) {
        <div class="row" [attr.data-testid]="'quick-add-row-' + $index">
          <mat-form-field appearance="outline" class="exercise-field">
            <mat-label i18n="@@quickAddConfig.exerciseLabel">Übung</mat-label>
            <mat-select
              [value]="row.exerciseId"
              (selectionChange)="setExerciseId($index, $event.value)"
              [attr.data-testid]="'quick-add-exercise-' + $index"
            >
              @for (opt of exerciseOptions; track opt.id) {
                <mat-option [value]="opt.id">{{ opt.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (row.mode === 'reps') {
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
          } @else {
            <span
              class="auto-badge"
              [attr.data-testid]="'quick-add-auto-badge-' + $index"
              i18n="@@quickAddConfig.autoCountBadge"
            >
              <mat-icon>videocam</mat-icon>
              Auto
            </span>
          }

          @if (isAutoCountCapable(row.exerciseId)) {
            <mat-checkbox
              [checked]="row.mode === 'auto-count'"
              (change)="setAutoCount($index, $event.checked)"
              [attr.data-testid]="'quick-add-autocount-' + $index"
              i18n="@@quickAddConfig.autoCount"
              >Auto-Messung</mat-checkbox
            >
          }

          @if (row.mode !== 'auto-count') {
            <mat-checkbox
              [checked]="row.inSpeedDial"
              (change)="setInSpeedDial($index, $event.checked)"
              [attr.data-testid]="'quick-add-speeddial-' + $index"
              i18n="@@quickAddConfig.inSpeedDial"
              >Im SpeedDial</mat-checkbox
            >
          }
          <button
            type="button"
            mat-icon-button
            (click)="clearRow($index)"
            [attr.aria-label]="clearRowAria"
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
      min-width: min(94vw, 520px);
    }
    .hint {
      margin: 0;
      opacity: 0.8;
      font-size: 0.9rem;
    }
    .row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .exercise-field {
      flex: 1 1 180px;
      min-width: 160px;
    }
    .reps-field {
      flex: 0 1 110px;
    }
    .auto-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      opacity: 0.85;
      padding: 4px 8px;
      border-radius: 8px;
      background: rgba(123, 159, 255, 0.12);
    }
    .auto-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `,
})
export class QuickAddConfigDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<QuickAddConfigDialogComponent>
  );
  private readonly userConfig = inject(UserConfigStore);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly maxRows = MAX_QUICK_ADDS;
  // Clears the whole slot (exercise, mode, reps) — not just the reps field —
  // since the picker landed. Keeps the assistive-tech announcement honest.
  protected readonly clearRowAria = $localize`:@@quickAddConfig.clearRowAria:Schnellaktion löschen`;
  protected readonly saving = signal(false);

  protected readonly exerciseOptions: ReadonlyArray<ExerciseOption> =
    buildExerciseOptions();

  protected isAutoCountCapable(exerciseId: string): boolean {
    return isAutoCountQuickAddExerciseId(exerciseId);
  }

  private readonly initialRows: DraftRow[] = ((): DraftRow[] => {
    const configured = this.userConfig.quickAdds();
    return Array.from({ length: MAX_QUICK_ADDS }, (_, i) => {
      const c = configured[i];
      const exerciseId = c?.exerciseId ?? PUSHUP_QUICK_ADD_EXERCISE_ID;
      // Coerce auto-count back to 'reps' if a persisted config points at an
      // exercise the camera detector no longer supports (or never did) —
      // otherwise the row would render the auto badge but the click handler
      // would no-op via `autoCountProfileForCatalogId() === null`.
      const effectiveMode: QuickAddMode = this.isAutoCountCapable(exerciseId)
        ? (c?.mode ?? 'reps')
        : 'reps';
      return {
        reps: c?.reps ?? null,
        // Auto-count rows can't also live in SpeedDial — see `setAutoCount`
        // for the full rationale. Strip the flag at load time so we don't
        // carry an inconsistent legacy config back into save.
        inSpeedDial:
          effectiveMode === 'auto-count' ? false : (c?.inSpeedDial ?? false),
        exerciseId,
        mode: effectiveMode,
      };
    });
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

  protected setExerciseId(index: number, exerciseId: string): void {
    const next = [...this.rowsState()];
    const prev = next[index];
    // Auto-count mode is invalid for exercises without a detector profile —
    // silently fall back to 'reps' so the saved row stays consistent.
    const mode: QuickAddMode = this.isAutoCountCapable(exerciseId)
      ? prev.mode
      : 'reps';
    next[index] = { ...prev, exerciseId, mode };
    this.rowsState.set(next);
  }

  protected setAutoCount(index: number, checked: boolean): void {
    const next = [...this.rowsState()];
    const prev = next[index];
    if (!this.isAutoCountCapable(prev.exerciseId)) return;
    // Auto-count + SpeedDial is incoherent: the FAB pipeline only knows how
    // to fire a fixed-reps `quickAdd(n)` call, so a SpeedDial item paired
    // with `reps: 0` would surface as a broken `+0 Reps` action. Force the
    // flag off here; the read-time facade filter
    // (`AppDataFacade.quickAddSuggestions`) defends against legacy configs.
    const inSpeedDial = checked ? false : prev.inSpeedDial;
    next[index] = {
      ...prev,
      mode: checked ? 'auto-count' : 'reps',
      inSpeedDial,
    };
    this.rowsState.set(next);
  }

  protected clearRow(index: number): void {
    const next = [...this.rowsState()];
    next[index] = {
      reps: null,
      inSpeedDial: false,
      exerciseId: PUSHUP_QUICK_ADD_EXERCISE_ID,
      mode: 'reps',
    };
    this.rowsState.set(next);
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const quickAdds: QuickAddConfig[] = this.rowsState()
      .filter((r) => isPersistableRow(r))
      .map((r) => {
        const base: QuickAddConfig = {
          // Auto-count rows persist a sentinel `reps: 0` — the dashboard
          // ignores it and routes to the camera dialog. Reps-rows always
          // have a positive integer here (filter above guarantees it).
          reps: r.mode === 'auto-count' ? 0 : (r.reps ?? 0),
          // Defence-in-depth: never persist `inSpeedDial: true` together
          // with `mode: 'auto-count'`. The UI hides the checkbox and
          // `setAutoCount` clears the flag, but a future code path
          // (programmatic edits, bulk import) might still send both — so
          // coerce here as well so the saved doc is always coherent.
          inSpeedDial: r.mode === 'auto-count' ? false : r.inSpeedDial,
          exerciseId: r.exerciseId,
          mode: r.mode,
        };
        return base;
      });

    try {
      const currentUi = this.userConfig.config()?.ui ?? {};
      await this.userConfig.save({
        ui: { ...currentUi, quickAdds },
      });
      this.dialogRef.close(quickAdds);
    } catch {
      this.snackBar.open(
        $localize`:@@quickAddConfig.saveError:Speichern fehlgeschlagen`,
        undefined,
        { duration: 3000 }
      );
      this.saving.set(false);
    }
  }
}

function isPersistableRow(r: DraftRow): boolean {
  if (r.mode === 'auto-count') return true;
  return r.reps !== null && r.reps > 0;
}

function buildExerciseOptions(): ExerciseOption[] {
  const opts: ExerciseOption[] = [
    {
      id: PUSHUP_QUICK_ADD_EXERCISE_ID,
      label: $localize`:@@exercise.category.pushup:Liegestütze`,
    },
  ];
  for (const def of EXERCISE_CATALOG) {
    if (def.measurement !== 'reps') continue;
    opts.push({
      id: def.id,
      label: exerciseDisplayName(def.id),
    });
  }
  return opts;
}
