import {
  AsyncPipe,
  DatePipe,
  NgTemplateOutlet,
  isPlatformBrowser,
} from '@angular/common';
import {
  Component,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { PushupRecord } from '@pu-stats/models';
import { UserContextService } from '@pu-auth/auth';
import { UserConfigApiService } from '@pu-stats/data-access';
import { firstValueFrom } from 'rxjs';
import {
  CreateEntryDialogComponent,
  CreateEntryResult,
  EntryDialogData,
} from '../create-entry-dialog/create-entry-dialog.component';

@Component({
  selector: 'app-stats-table',
  imports: [
    MatCardModule,
    MatProgressSpinnerModule,
    DatePipe,
    AsyncPipe,
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
  readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly sort = viewChild(MatSort);

  readonly entries = input<PushupRecord[]>([]);
  readonly readOnly = input(false);
  // 'create' is accepted for type compatibility with EntriesStore but unused here;
  // entry creation is handled by CreateEntryDialogComponent.
  readonly busyAction = input<'create' | 'update' | 'delete' | null>(null);
  readonly busyId = input<string | null>(null);

  readonly create = output<{
    timestamp: string;
    reps: number;
    sets?: number[];
    source?: string;
    type?: string;
  }>();
  readonly update = output<{
    id: string;
    timestamp: string;
    reps: number;
    sets?: number[];
    source: string;
    type?: string;
  }>();
  readonly remove = output<string>();

  private readonly user = inject(UserContextService);
  private readonly userConfigApi = inject(UserConfigApiService);

  readonly showSourceColumn = signal(false);

  readonly displayedColumns = computed(() => {
    const base = ['timestamp', 'reps', 'type'];
    const cols = this.showSourceColumn() ? [...base, 'source'] : base;
    return this.readOnly() ? cols : [...cols, 'actions'];
  });

  readonly dataSource = new MatTableDataSource<PushupRecord>([]);

  constructor() {
    this.dataSource.sortingDataAccessor = (item, property) => {
      if (property === 'timestamp') return new Date(item.timestamp).getTime();
      if (property === 'reps') return item.reps;
      if (property === 'source') return item.source;
      if (property === 'type') return item.type || 'Standard';
      return '';
    };

    if (this.isBrowser) {
      void this.loadShowSourceFromDb();
    }

    effect(() => {
      this.dataSource.data = this.entries();
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

  openEditDialog(entry: PushupRecord): void {
    const dialogData: EntryDialogData = {
      timestamp: entry.timestamp,
      reps: entry.reps,
      sets: entry.sets,
      source: entry.source,
      type: entry.type,
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
          this.update.emit({
            id: entry._id,
            timestamp: result.timestamp,
            reps: result.reps,
            sets: result.sets,
            source: result.source,
            type: result.type,
          });
        }
      });
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
