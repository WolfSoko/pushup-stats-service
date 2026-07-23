import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type ExerciseEntry } from '@pu-stats/models';
import { CallableFunctionsService } from './callable-functions.service';
import { errorMessage, toggleSetMember } from './admin-page.helpers';
import { type BulkDeleteResult } from './admin-page.models';
import {
  DeleteEntriesDialogComponent,
  type DeleteEntriesDialogData,
} from './delete-entries-dialog.component';
import {
  adminEntrySortValue,
  entryExerciseName,
  entryValueDisplay,
} from './user-entries.helpers';

/**
 * Sortable, selectable table for one user's exercise entries — the drill-down
 * body of `UserEntriesPageComponent`. Owns row/select-all checkboxes and the
 * `adminDeleteUserEntries` delete flow (single row or the current selection).
 * The parent still owns loading the list (it needs it for the header stats)
 * and the shared edit dialog, so an edit click is emitted via `edit`, and a
 * successful delete via `refresh` so the parent reloads — mirroring how
 * `openEditDialog` reloads rather than optimistic-merges.
 */
@Component({
  selector: 'app-user-entries-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatIconModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './user-entries-table.component.html',
  styleUrl: './user-entries-table.component.scss',
})
export class UserEntriesTableComponent {
  private readonly dialog = inject(MatDialog);
  private readonly callables = inject(CallableFunctionsService);

  readonly entries = input.required<ExerciseEntry[]>();
  readonly uid = input.required<string>();

  readonly edit = output<ExerciseEntry>();
  readonly refresh = output<void>();

  readonly displayedColumns = [
    'select',
    'timestamp',
    'exercise',
    'value',
    'source',
    'actions',
  ];
  readonly editTooltip = $localize`:@@admin.entry.editTooltip:Eintrag bearbeiten`;
  readonly deleteTooltip = $localize`:@@admin.entry.deleteTooltip:Eintrag löschen`;
  readonly selectAllLabel = $localize`:@@admin.entries.selectAll:Alle Einträge auswählen`;
  readonly selectRowLabel = $localize`:@@admin.entries.selectRow:Eintrag auswählen`;

  readonly exerciseName = entryExerciseName;
  readonly valueDisplay = entryValueDisplay;

  readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  readonly deleting = signal(false);
  readonly error = signal<string | null>(null);

  readonly hasSelection = computed(() => this.selectedIds().size > 0);
  readonly allSelected = computed(() => {
    const list = this.entries();
    const selected = this.selectedIds();
    return list.length > 0 && list.every((e) => selected.has(e._id));
  });
  readonly someSelected = computed(
    () => this.hasSelection() && !this.allSelected()
  );

  readonly dataSource = new MatTableDataSource<ExerciseEntry>([]);
  private readonly sort = viewChild<MatSort>('entriesSort');

  constructor() {
    this.dataSource.sortingDataAccessor = adminEntrySortValue;
    effect(() => {
      this.dataSource.data = this.entries();
    });
    effect(() => {
      const s = this.sort();
      if (s) this.dataSource.sort = s;
    });
  }

  isSelected(entry: ExerciseEntry): boolean {
    return this.selectedIds().has(entry._id);
  }

  toggleRow(entry: ExerciseEntry, checked: boolean): void {
    this.selectedIds.update((s) => toggleSetMember(s, entry._id, checked));
  }

  toggleAll(checked: boolean): void {
    this.selectedIds.set(
      checked ? new Set(this.entries().map((e) => e._id)) : new Set()
    );
  }

  async deleteOne(entry: ExerciseEntry): Promise<void> {
    await this.confirmAndDelete([entry._id]);
  }

  async deleteSelected(): Promise<void> {
    await this.confirmAndDelete([...this.selectedIds()]);
  }

  private async confirmAndDelete(entryIds: string[]): Promise<void> {
    if (entryIds.length === 0) return;

    const ref = this.dialog.open<
      DeleteEntriesDialogComponent,
      DeleteEntriesDialogData,
      boolean
    >(DeleteEntriesDialogComponent, {
      data: { count: entryIds.length },
      width: '420px',
    });
    const confirmed = await firstValueFrom(ref.afterClosed());
    if (!confirmed) return;

    this.deleting.set(true);
    this.error.set(null);
    try {
      const fn = this.callables.call<
        { uid: string; entryIds: string[] },
        BulkDeleteResult
      >('adminDeleteUserEntries');
      await fn({ uid: this.uid(), entryIds });
      this.refresh.emit();
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.deleting.set(false);
    }
  }
}
