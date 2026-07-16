import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { type ExerciseEntry } from '@pu-stats/models';
import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { CallableFunctionsService } from './callable-functions.service';
import { AdminEntryEditDialogComponent } from './entry-edit-dialog.component';
import { errorMessage } from './admin-page.helpers';
import {
  adminEntrySortValue,
  entryExerciseName,
  entryValueDisplay,
} from './user-entries.helpers';

/**
 * Admin drill-down into one user's exercise entries, as a routed page
 * (`/admin/users/:uid/entries`). Reads through the `adminListUserEntries`
 * callable (client Firestore rules scope reads to the owner), renders a
 * sortable table, and opens {@link AdminEntryEditDialogComponent} per row to
 * patch an entry via `adminUpdateUserEntry`.
 */
@Component({
  selector: 'app-user-entries-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    PageHeaderComponent,
  ],
  templateUrl: './user-entries-page.component.html',
  styleUrl: './user-entries-page.component.scss',
})
export class UserEntriesPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly callables = inject(CallableFunctionsService);
  private readonly dialog = inject(MatDialog);

  readonly uid = this.route.snapshot.paramMap.get('uid') ?? '';
  // The admin list passes a friendly label via navigation state; a direct
  // deep-link or reload loses it, so fall back to the uid.
  readonly userLabel =
    (typeof history !== 'undefined' &&
      (history.state as { label?: string } | null)?.label) ||
    this.uid;

  readonly displayedColumns = [
    'timestamp',
    'exercise',
    'value',
    'source',
    'actions',
  ];
  readonly editTooltip = $localize`:@@admin.entry.editTooltip:Eintrag bearbeiten`;
  readonly refreshTooltip = $localize`:@@admin.entries.refresh:Neu laden`;

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly entries = signal<ExerciseEntry[]>([]);

  readonly dataSource = new MatTableDataSource<ExerciseEntry>([]);
  private readonly sort = viewChild<MatSort>('entriesSort');

  readonly exerciseName = entryExerciseName;
  readonly valueDisplay = entryValueDisplay;

  constructor() {
    this.dataSource.sortingDataAccessor = adminEntrySortValue;
    effect(() => {
      this.dataSource.data = this.entries();
    });
    effect(() => {
      const s = this.sort();
      if (s) this.dataSource.sort = s;
    });
    void this.loadEntries();
  }

  async loadEntries(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const fn = this.callables.call<{ uid: string }, ExerciseEntry[]>(
        'adminListUserEntries'
      );
      const result = await fn({ uid: this.uid });
      this.entries.set(result.data);
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  async openEditDialog(entry: ExerciseEntry): Promise<void> {
    const ref = this.dialog.open(AdminEntryEditDialogComponent, {
      data: entry,
      width: 'min(92vw, 420px)',
      maxWidth: '92vw',
    });
    const patch = await firstValueFrom(ref.afterClosed());
    if (!patch) return;

    try {
      const fn = this.callables.call('adminUpdateUserEntry');
      await fn({ uid: this.uid, entryId: entry._id, patch });
      this.entries.update((list) =>
        list.map((e) =>
          e._id === entry._id ? ({ ...e, ...patch } as ExerciseEntry) : e
        )
      );
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }
}
