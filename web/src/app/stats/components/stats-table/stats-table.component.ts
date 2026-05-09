import { ScrollingModule } from '@angular/cdk/scrolling';
import { DatePipe, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  LOCALE_ID,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UserContextService } from '@pu-auth/auth';
import { UserConfigApiService } from '@pu-stats/data-access';
import {
  displayPushupType,
  findExerciseDefinition,
  PushupRecord,
  pushupRecordToUnified,
  UnifiedEntry,
  unifiedEntryFilterKey,
} from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';
import {
  CreateEntryDialogComponent,
  CreateEntryResult,
  EntryDialogData,
} from '../create-entry-dialog/create-entry-dialog.component';
import {
  ExerciseEntryDialogComponent,
  ExerciseEntryDialogData,
  ExerciseEntryDialogResult,
} from '../exercise-entry-dialog/exercise-entry-dialog.component';
import { exerciseDisplayName } from '../../i18n/exercise-display-names';

/**
 * Update payload emitted from the row's edit button. Always carries the
 * `kind` discriminator so the parent store can dispatch to the right
 * Firestore service. `exerciseId` and `variantId` are only meaningful
 * when `kind === 'exercise'`; `type` only when `kind === 'pushup'`.
 */
export interface StatsTableUpdate {
  kind: 'pushup' | 'exercise';
  id: string;
  timestamp: string;
  reps: number;
  sets?: number[];
  source: string;
  type?: string;
  exerciseId?: string;
  variantId?: string;
}

export interface StatsTableRemove {
  kind: 'pushup' | 'exercise';
  id: string;
}

@Component({
  selector: 'app-stats-table',
  imports: [
    MatCardModule,
    MatProgressSpinnerModule,
    DatePipe,
    NgTemplateOutlet,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSortModule,
    MatRippleModule,
    MatTooltipModule,
    ScrollingModule,
  ],
  templateUrl: './stats-table.component.html',
  styleUrl: './stats-table.component.scss',
})
export class StatsTableComponent {
  readonly dialog = inject(MatDialog);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly locale = inject(LOCALE_ID) as string;
  readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly typeLabel = (entry: UnifiedEntry): string => {
    if (entry.kind === 'pushup') {
      return displayPushupType(entry.variantType, this.locale);
    }
    // Typ is a sub-type (pushup variant), not the exercise itself —
    // surfacing the exercise name here would duplicate the Übung column.
    return entry.variantId ?? '';
  };

  readonly sort = viewChild(MatSort);

  /**
   * The table accepts both legacy `PushupRecord[]` (dashboard preview)
   * and the new `UnifiedEntry[]` (history page). Pushup arrays are
   * mapped on the way in via `pushupRecordToUnified`. Backwards-compat
   * keeps the dashboard caller untouched.
   */
  readonly entries = input<UnifiedEntry[] | PushupRecord[]>([]);
  readonly readOnly = input(false);
  readonly busyAction = input<'create' | 'update' | 'delete' | null>(null);
  readonly busyId = input<string | null>(null);

  readonly create = output<{
    timestamp: string;
    reps: number;
    sets?: number[];
    source?: string;
    type?: string;
  }>();
  readonly update = output<StatsTableUpdate>();
  readonly remove = output<StatsTableRemove>();

  private readonly user = inject(UserContextService);
  private readonly userConfigApi = inject(UserConfigApiService);

  readonly showSourceColumn = signal(false);

  /**
   * Whether the current row set spans more than one distinct exercise.
   * Adds the "Übung" column only when true so a uniform set (pushup-only
   * preview, or a user who's logged just squats) does not show a column
   * where every cell repeats the same label. Discrimination is by
   * `unifiedEntryFilterKey` so all pushup variants count as one entry.
   */
  readonly showExerciseColumn = computed(() => {
    const rows = this.unifiedEntries();
    if (rows.length === 0) return false;
    const distinctKeys = new Set(rows.map((r) => unifiedEntryFilterKey(r)));
    return distinctKeys.size > 1;
  });

  readonly displayedColumns = computed(() => {
    const cols: string[] = ['timestamp', 'reps'];
    if (this.showExerciseColumn()) cols.push('exercise');
    cols.push('type');
    if (this.showSourceColumn()) cols.push('source');
    if (!this.readOnly()) cols.push('actions');
    return cols;
  });

  /** Normalize each input element to UnifiedEntry. The two callers
   * pass homogeneous arrays today (dashboard preview = PushupRecord[],
   * history page = UnifiedEntry[]), but a per-element check is barely
   * costlier than a first-element heuristic and keeps mixed arrays
   * working if a future caller ever feeds one. */
  private readonly unifiedEntries = computed<UnifiedEntry[]>(() => {
    const raw = this.entries() ?? [];
    if (raw.length === 0) return [];
    return (raw as Array<PushupRecord | UnifiedEntry>).map((r) =>
      'kind' in r ? r : pushupRecordToUnified(r)
    );
  });

  readonly dataSource = new MatTableDataSource<UnifiedEntry>([]);

  /** Localized "Übung" column label, used in the template. */
  readonly exerciseColumnLabel = $localize`:@@colExercise:Übung`;

  exerciseLabel(entry: UnifiedEntry): string {
    if (entry.kind === 'pushup') {
      return $localize`:@@exercise.category.pushup:Liegestütze`;
    }
    const def = findExerciseDefinition(entry.exerciseId);
    if (!def) return entry.exerciseId;
    return exerciseDisplayName(def.id);
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (item, property) => {
      if (property === 'timestamp') return new Date(item.timestamp).getTime();
      if (property === 'reps') return item.reps;
      if (property === 'source') return item.source;
      if (property === 'type') return this.typeLabel(item);
      if (property === 'exercise') return this.exerciseLabel(item);
      return '';
    };

    if (this.isBrowser) {
      void this.loadShowSourceFromDb();
    }

    effect(() => {
      this.dataSource.data = this.unifiedEntries();
    });

    effect(() => {
      const s = this.sort();
      if (s) {
        this.dataSource.sort = s;
      }
    });
  }

  openCreateDialog(): void {
    this.dialog
      .open<CreateEntryDialogComponent, void, CreateEntryResult>(
        CreateEntryDialogComponent,
        { width: 'min(92vw, 420px)', maxWidth: '92vw' }
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) this.create.emit(result);
      });
  }

  openEditDialog(entry: UnifiedEntry): void {
    if (entry.kind === 'pushup') {
      const dialogData: EntryDialogData = {
        timestamp: entry.timestamp,
        reps: entry.reps,
        sets: entry.sets,
        source: entry.source,
        type: entry.variantType ?? undefined,
      };
      this.dialog
        .open<CreateEntryDialogComponent, EntryDialogData, CreateEntryResult>(
          CreateEntryDialogComponent,
          {
            width: 'min(92vw, 420px)',
            maxWidth: '92vw',
            data: dialogData,
          }
        )
        .afterClosed()
        .subscribe((result) => {
          if (result) {
            // Strip a single-element sets array — it carries no info
            // beyond the reps total and would otherwise round-trip an
            // empty per-set breakdown into Firestore. Same heuristic
            // as the exercise branch below.
            this.update.emit({
              kind: 'pushup',
              id: entry._id,
              timestamp: result.timestamp,
              reps: result.reps,
              sets: result.sets.length > 1 ? result.sets : undefined,
              source: result.source,
              type: result.type,
            });
          }
        });
      return;
    }

    const exerciseName = this.exerciseLabel(entry);
    this.dialog
      .open<
        ExerciseEntryDialogComponent,
        ExerciseEntryDialogData,
        ExerciseEntryDialogResult
      >(ExerciseEntryDialogComponent, {
        width: 'min(92vw, 420px)',
        maxWidth: '92vw',
        data: {
          exerciseId: entry.exerciseId,
          exerciseName,
          initial: {
            timestamp: entry.timestamp,
            reps: entry.reps,
            ...(entry.sets ? { sets: entry.sets } : {}),
          },
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.update.emit({
            kind: 'exercise',
            id: entry._id,
            exerciseId: entry.exerciseId,
            timestamp: result.timestamp,
            reps: result.reps,
            sets: result.sets.length > 1 ? result.sets : undefined,
            source: entry.source,
          });
        }
      });
  }

  emitRemove(entry: UnifiedEntry): void {
    this.remove.emit({ kind: entry.kind, id: entry._id });
  }

  isBusy(action: 'update' | 'delete', id: string): boolean {
    return this.busyAction() === action && this.busyId() === id;
  }

  async toggleSourceColumn(): Promise<void> {
    const next = !this.showSourceColumn();
    this.showSourceColumn.set(next);

    if (!this.isBrowser) return;

    try {
      await firstValueFrom(
        this.userConfigApi.updateConfig(this.user.userIdSafe(), {
          ui: { showSourceColumn: next },
        })
      );
    } catch {
      // If saving fails, keep UI responsive; we'll try again on next toggle.
    }
  }

  formatSets(sets: number[]): string {
    if (!sets?.length) return '';
    const allSame = sets.every((s) => s === sets[0]);
    return allSame ? `${sets.length}×${sets[0]}` : sets.join(' + ');
  }

  private async loadShowSourceFromDb(): Promise<void> {
    try {
      const cfg = await firstValueFrom(
        this.userConfigApi.getConfig(this.user.userIdSafe())
      );
      this.showSourceColumn.set(!!cfg.ui?.showSourceColumn);
    } catch {
      // ignore; keep default
    }
  }
}
