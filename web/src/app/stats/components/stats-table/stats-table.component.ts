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
  formatEntryDisplay,
  formatExerciseValue,
  measurementValueField,
  PushupRecord,
  pushupRecordToUnified,
  UnifiedEntry,
  unifiedEntryFilterKey,
} from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';
import {
  ExerciseEntryDialogResult,
  PushupEntryDialogResult,
  TrainingEntryDialogComponent,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from '../training-entry-dialog/training-entry-dialog.component';
import { exerciseDisplayName } from '../../i18n/exercise-display-names';

/**
 * Update payload emitted from the row's edit button. Always carries the
 * `kind` discriminator so the parent store can dispatch to the right
 * Firestore service. `exerciseId` and `variantId` are only meaningful
 * when `kind === 'exercise'`; `type` only when `kind === 'pushup'`.
 *
 * Either `reps` (with optional `sets`) or `durationSec` is set,
 * depending on the underlying exercise's measurement.
 */
export interface StatsTableUpdate {
  kind: 'pushup' | 'exercise';
  id: string;
  timestamp: string;
  reps?: number;
  sets?: number[];
  /**
   * Per-interval breakdown for endurance exercises (`time` /
   * `distance` / `distance-time`). Like `sets`, an empty array is
   * the explicit clear sentinel; the data-access layer maps it to a
   * Firestore `deleteField()` so a stale breakdown can be wiped.
   */
  intervals?: number[];
  durationSec?: number;
  distanceM?: number;
  source: string;
  type?: string;
  exerciseId?: string;
  /**
   * Tri-state forwarded from `EntryDialogResult.variantId`:
   *   - `string` (non-empty): set the variant.
   *   - `null`: clear an existing variant — the store should issue a
   *     Firestore `deleteField()` so the doc no longer carries one.
   *   - `undefined`: no change (omitted from the patch).
   */
  variantId?: string | null;
}

export interface StatsTableRemove {
  kind: 'pushup' | 'exercise';
  id: string;
}

/**
 * Create payload emitted from the table. Mirrors {@link StatsTableUpdate}
 * but without `id`, since a new entry has no doc to patch yet. The `kind`
 * discriminator lets the parent store dispatch to `createPushup` or
 * `createEntry` without re-introspecting the dialog result.
 */
export interface StatsTableCreate {
  kind: 'pushup' | 'exercise';
  timestamp: string;
  reps?: number;
  sets?: number[];
  /** Per-interval breakdown for endurance exercises. Mutually
   *  exclusive with `sets` in practice. */
  intervals?: number[];
  durationSec?: number;
  distanceM?: number;
  source?: string;
  type?: string;
  exerciseId?: string;
  variantId?: string;
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

  readonly create = output<StatsTableCreate>();
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
      // The "reps" column renders measurement-aware values (reps for
      // sit-ups/squats, durationSec for plank, distanceM for the
      // composite distance-time cardio.running). Sort by the primary
      // measurement field so the displayed value drives ordering —
      // otherwise distance-time rows would tie on duration and plank
      // rows would tie on the normalized 0 reps.
      if (property === 'reps') return this.sortValue(item);
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
      .open<
        TrainingEntryDialogComponent,
        TrainingEntryDialogData | null,
        TrainingEntryDialogResult
      >(TrainingEntryDialogComponent, {
        width: 'min(92vw, 420px)',
        maxWidth: '92vw',
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.create.emit(this.toCreatePayload(result));
      });
  }

  openEditDialog(entry: UnifiedEntry): void {
    const dialogData: TrainingEntryDialogData =
      entry.kind === 'pushup'
        ? {
            kind: 'pushup',
            timestamp: entry.timestamp,
            reps: entry.reps,
            sets: entry.sets,
            source: entry.source,
            type: entry.variantType ?? undefined,
          }
        : {
            kind: 'exercise',
            timestamp: entry.timestamp,
            reps: entry.reps,
            sets: entry.sets,
            ...(entry.durationSec !== undefined
              ? { durationSec: entry.durationSec }
              : {}),
            ...(entry.distanceM !== undefined
              ? { distanceM: entry.distanceM }
              : {}),
            exerciseId: entry.exerciseId,
            variantId: entry.variantId,
          };

    this.dialog
      .open<
        TrainingEntryDialogComponent,
        TrainingEntryDialogData,
        TrainingEntryDialogResult
      >(TrainingEntryDialogComponent, {
        width: 'min(92vw, 420px)',
        maxWidth: '92vw',
        data: dialogData,
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.update.emit(this.toUpdatePayload(entry, result));
      });
  }

  private toCreatePayload(result: TrainingEntryDialogResult): StatsTableCreate {
    if (result.kind === 'pushup') {
      return this.pushupCreatePayload(result);
    }
    return this.exerciseCreatePayload(result);
  }

  private pushupCreatePayload(
    result: PushupEntryDialogResult
  ): StatsTableCreate {
    return {
      kind: 'pushup',
      timestamp: result.timestamp,
      reps: result.reps,
      ...(result.sets.length > 1 ? { sets: result.sets } : {}),
      source: result.source,
      type: result.type,
    };
  }

  private exerciseCreatePayload(
    result: ExerciseEntryDialogResult
  ): StatsTableCreate {
    return {
      kind: 'exercise',
      exerciseId: result.exerciseId,
      timestamp: result.timestamp,
      ...(result.measurement === 'time'
        ? {
            durationSec: result.durationSec ?? 0,
            ...(result.intervals.length > 0
              ? { intervals: result.intervals }
              : {}),
          }
        : result.measurement === 'distance-time'
          ? {
              distanceM: result.distanceM ?? 0,
              durationSec: result.durationSec ?? 0,
              ...(result.intervals.length > 0
                ? { intervals: result.intervals }
                : {}),
            }
          : {
              reps: result.reps,
              ...(result.sets.length > 1 ? { sets: result.sets } : {}),
            }),
      ...(result.variantId ? { variantId: result.variantId } : {}),
    };
  }

  private toUpdatePayload(
    entry: UnifiedEntry,
    result: TrainingEntryDialogResult
  ): StatsTableUpdate {
    // Edit mode locks the kind picker, so dialog result kind always
    // matches the row's kind. The kind-narrowed branches keep the
    // payload type-safe even though the runtime guard is on `entry`.
    if (entry.kind === 'pushup' && result.kind === 'pushup') {
      return this.pushupUpdatePayload(entry, result);
    }
    if (entry.kind === 'exercise' && result.kind === 'exercise') {
      return this.exerciseUpdatePayload(entry, result);
    }
    throw new Error(
      `toUpdatePayload: kind mismatch — entry='${entry.kind}', result='${result.kind}'`
    );
  }

  private pushupUpdatePayload(
    entry: Extract<UnifiedEntry, { kind: 'pushup' }>,
    result: PushupEntryDialogResult
  ): StatsTableUpdate {
    return {
      kind: 'pushup',
      id: entry._id,
      timestamp: result.timestamp,
      reps: result.reps,
      // Single-set collapse: if the original doc carried a multi-set
      // breakdown, emit `[]` as the explicit clear sentinel so the
      // store maps it to a Firestore `deleteField()`; `undefined`
      // would just omit the field and leave stale sets behind.
      sets:
        result.sets.length > 1
          ? result.sets
          : entry.sets !== undefined
            ? []
            : undefined,
      source: result.source,
      type: result.type,
    };
  }

  private exerciseUpdatePayload(
    entry: Extract<UnifiedEntry, { kind: 'exercise' }>,
    result: ExerciseEntryDialogResult
  ): StatsTableUpdate {
    const intervalsPatch =
      result.intervals.length > 0
        ? { intervals: result.intervals }
        : entry.intervals !== undefined
          ? { intervals: [] }
          : {};
    return {
      kind: 'exercise',
      id: entry._id,
      exerciseId: entry.exerciseId,
      timestamp: result.timestamp,
      source: entry.source,
      ...(result.measurement === 'time'
        ? {
            durationSec: result.durationSec ?? 0,
            ...intervalsPatch,
          }
        : result.measurement === 'distance-time'
          ? {
              distanceM: result.distanceM ?? 0,
              durationSec: result.durationSec ?? 0,
              ...intervalsPatch,
            }
          : {
              reps: result.reps,
              sets:
                result.sets.length > 1
                  ? result.sets
                  : entry.sets !== undefined
                    ? []
                    : undefined,
            }),
      ...(result.variantId !== undefined
        ? { variantId: result.variantId }
        : {}),
    };
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

  /**
   * Renders the "Reps" column for any measurement type. Pushup rows
   * fall through to the legacy reps + sets path; for catalog
   * exercises we route through {@link formatEntryDisplay} which
   * handles the composite distance-time format and the per-unit
   * formatting in one place.
   */
  formatEntry(entry: UnifiedEntry): string {
    if (entry.kind === 'pushup') return String(entry.reps);
    const def = findExerciseDefinition(entry.exerciseId);
    if (!def) return String(entry.reps);
    return formatEntryDisplay(entry, def);
  }

  /**
   * Sort key for the "Reps" column. Picks the primary measurement
   * field per definition: distance for cardio.running, duration for
   * plank, reps for everything else. Falls back to `entry.reps` when
   * the catalog id is missing — same fallback the table uses for
   * stale entries.
   */
  private sortValue(entry: UnifiedEntry): number {
    if (entry.kind === 'pushup') return entry.reps;
    const def = findExerciseDefinition(entry.exerciseId);
    if (!def) return entry.reps;
    const field = measurementValueField(def.measurement);
    return (entry[field] as number | undefined) ?? entry.reps;
  }

  /**
   * Format a duration cell. Delegates to the unit-aware
   * `formatExerciseValue` so the same helper drives the section card,
   * the dialog cap hint, and this column — keeps display logic in one
   * place when more units (kg, m) land in later phases.
   */
  formatDuration(totalSec: number): string {
    return formatExerciseValue(totalSec, 's');
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
