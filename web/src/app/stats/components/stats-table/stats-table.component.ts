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
import { RouterLink } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import { UserConfigApiService } from '@pu-stats/data-access';
import {
  displayPushupType,
  findExerciseDefinition,
  findExerciseWikiEntry,
  findPushupTypeByStoredValue,
  formatEntryDisplay,
  formatExerciseValue,
  measurementValueField,
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
    RouterLink,
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
    if (entry.exerciseId === 'pushup') {
      return displayPushupType(entry.variantId ?? '', this.locale);
    }
    // Typ is a sub-type (variant), not the exercise itself —
    // surfacing the exercise name here would duplicate the Übung column.
    return entry.variantId ?? '';
  };

  readonly sort = viewChild(MatSort);

  /**
   * The id of the entry to scroll-into-view and briefly highlight after
   * the next render. Set by the entries page from the `#entry-<id>` URL
   * fragment so dashboard tile links can drill into the matching row.
   * Null when the page was opened without a fragment.
   */
  readonly highlightEntryId = input<string | null>(null);

  readonly entries = input<UnifiedEntry[]>([]);
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

  private readonly unifiedEntries = computed<UnifiedEntry[]>(
    () => this.entries() ?? []
  );

  readonly dataSource = new MatTableDataSource<UnifiedEntry>([]);

  /** Localized "Übung" column label, used in the template. */
  readonly exerciseColumnLabel = $localize`:@@colExercise:Übung`;

  exerciseLabel(entry: UnifiedEntry): string {
    if (entry.exerciseId === 'pushup') {
      return $localize`:@@exercise.category.pushup:Liegestütze`;
    }
    const def = findExerciseDefinition(entry.exerciseId);
    if (!def) return entry.exerciseId;
    return exerciseDisplayName(def.id);
  }

  /**
   * Wiki deep-link for the entry's exercise label. Pushup rows route to
   * the dedicated `/wiki/liegestuetz-typen` wiki with the variant slug
   * (when known); catalog exercise rows route to `/wiki/uebungen/<slug>`
   * when an entry exists, else to the list page so a stale catalog id
   * can't 404 the link. Always returns a usable target — every row in
   * the stats table maps to either the pushup wiki or the generic
   * exercises wiki, so the column is always rendered as a link.
   */
  exerciseWikiLink(entry: UnifiedEntry): string[] {
    if (entry.exerciseId === 'pushup') {
      const variant = findPushupTypeByStoredValue(entry.variantId);
      return variant
        ? ['/wiki/liegestuetz-typen', variant.slug]
        : ['/wiki/liegestuetz-typen'];
    }
    const wikiEntry = findExerciseWikiEntry(entry.exerciseId);
    return wikiEntry ? ['/wiki/uebungen', wikiEntry.slug] : ['/wiki/uebungen'];
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

    // Drill-in from the dashboard tile: when a `#entry-<id>` fragment
    // resolves to a row in the current data set, scroll the matching
    // row into view. The cdk-virtual-scroll-viewport here only wraps a
    // scrollable container — the inner mat-table doesn't use
    // *cdkVirtualFor, so every row is in the DOM and a plain
    // getElementById/scrollIntoView is the source of truth (a viewport
    // scrollToIndex would compute `index * itemSize`, which only
    // coincidentally matches the rendered row position when input
    // order and the active matSort happen to line up).
    effect(() => {
      const targetId = this.highlightEntryId();
      const rows = this.unifiedEntries();
      if (!targetId || !this.isBrowser) return;
      if (!rows.some((r) => r._id === targetId)) return;
      // setTimeout (not queueMicrotask) — MatTable re-renders rows
      // asynchronously after dataSource.data is assigned in the sibling
      // effect, so the matching <mat-row> may not exist in the DOM
      // until the next macrotask.
      setTimeout(() => {
        document
          .getElementById(`entry-${targetId}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
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
      entry.exerciseId === 'pushup'
        ? {
            kind: 'pushup',
            timestamp: entry.timestamp,
            reps: entry.reps,
            sets: entry.sets,
            source: entry.source,
            type: entry.variantId ?? undefined,
          }
        : {
            kind: 'exercise',
            timestamp: entry.timestamp,
            reps: entry.reps,
            sets: entry.sets,
            intervals: entry.intervals,
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
    // `intervals` is required on the dialog result, but the helpers
    // are also called from programmatic tests / future callers where
    // the field might be omitted. Default to `[]` so `.length` is
    // always safe.
    const intervals = result.intervals ?? [];
    return {
      kind: 'exercise',
      exerciseId: result.exerciseId,
      timestamp: result.timestamp,
      ...(result.measurement === 'time'
        ? {
            durationSec: result.durationSec ?? 0,
            ...(intervals.length > 0 ? { intervals } : {}),
          }
        : result.measurement === 'distance-time'
          ? {
              distanceM: result.distanceM ?? 0,
              durationSec: result.durationSec ?? 0,
              ...(intervals.length > 0 ? { intervals } : {}),
            }
          : result.measurement === 'distance'
            ? {
                // Pure-distance exercises don't ship in the catalog
                // yet, but the dialog emits a `distance` branch so
                // the create path must accept it; otherwise the
                // distanceM + intervals would silently fall through
                // to the strength shape and be dropped.
                distanceM: result.distanceM ?? 0,
                ...(intervals.length > 0 ? { intervals } : {}),
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
    // matches the row's exercise. The exerciseId-narrowed branches keep
    // the payload type-safe even though the runtime guard is on `entry`.
    if (entry.exerciseId === 'pushup' && result.kind === 'pushup') {
      return this.pushupUpdatePayload(entry, result);
    }
    if (entry.exerciseId !== 'pushup' && result.kind === 'exercise') {
      return this.exerciseUpdatePayload(entry, result);
    }
    throw new Error(
      `toUpdatePayload: kind mismatch — exerciseId='${entry.exerciseId}', result='${result.kind}'`
    );
  }

  private pushupUpdatePayload(
    entry: UnifiedEntry,
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
    entry: UnifiedEntry,
    result: ExerciseEntryDialogResult
  ): StatsTableUpdate {
    // The dialog disables the category + exercise pickers in edit mode
    // (see `TrainingEntryDialogComponent`), so an update can never
    // change an entry's measurement type. That's why each branch below
    // only needs to handle its own breakdown field — there's no
    // strength→endurance flip where we'd have to wipe a stale `sets`
    // from an entry that just became endurance (or vice versa). If
    // measurement switches during edit ever land, this helper plus the
    // Firestore-rules mutex would need explicit opposite-side clears.
    const resultIntervals = result.intervals ?? [];
    const intervalsPatch =
      resultIntervals.length > 0
        ? { intervals: resultIntervals }
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
          : result.measurement === 'distance'
            ? {
                distanceM: result.distanceM ?? 0,
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
    this.remove.emit({ kind: 'exercise', id: entry._id });
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
