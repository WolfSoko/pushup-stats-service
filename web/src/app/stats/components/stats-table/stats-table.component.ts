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
import { UnifiedEntry } from '@pu-stats/models';
import { firstValueFrom } from 'rxjs';
import { TrainingEntryDialogComponent } from '../training-entry-dialog/training-entry-dialog.component';
import {
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from '../training-entry-dialog/training-entry-dialog.models';
import {
  buildDisplayedColumns,
  exerciseLabel,
  exerciseWikiLink,
  formatEntry,
  formatSets,
  sortingValue,
  spansMultipleExercises,
  typeLabel,
} from './stats-table.format';
import {
  StatsTableCreate,
  StatsTableRemove,
  StatsTableUpdate,
} from './stats-table.models';
import {
  toCreatePayload,
  toEditDialogData,
  toUpdatePayload,
} from './stats-table.payloads';

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

  readonly typeLabel = (entry: UnifiedEntry): string =>
    typeLabel(entry, this.locale);

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

  readonly showExerciseColumn = computed(() =>
    spansMultipleExercises(this.unifiedEntries())
  );

  readonly displayedColumns = computed(() =>
    buildDisplayedColumns({
      showExercise: this.showExerciseColumn(),
      showSource: this.showSourceColumn(),
      readOnly: this.readOnly(),
    })
  );

  private readonly unifiedEntries = computed<UnifiedEntry[]>(
    () => this.entries() ?? []
  );

  readonly dataSource = new MatTableDataSource<UnifiedEntry>([]);

  readonly exerciseColumnLabel = $localize`:@@colExercise:Übung`;

  exerciseLabel(entry: UnifiedEntry): string {
    return exerciseLabel(entry);
  }

  exerciseWikiLink(entry: UnifiedEntry): string[] {
    return exerciseWikiLink(entry);
  }

  constructor() {
    this.dataSource.sortingDataAccessor = (item, property) =>
      sortingValue(item, property, this.locale);

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
        this.create.emit(toCreatePayload(result));
      });
  }

  openEditDialog(entry: UnifiedEntry): void {
    this.dialog
      .open<
        TrainingEntryDialogComponent,
        TrainingEntryDialogData,
        TrainingEntryDialogResult
      >(TrainingEntryDialogComponent, {
        width: 'min(92vw, 420px)',
        maxWidth: '92vw',
        data: toEditDialogData(entry),
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;
        this.update.emit(toUpdatePayload(entry, result));
      });
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
    return formatSets(sets);
  }

  formatEntry(entry: UnifiedEntry): string {
    return formatEntry(entry);
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
