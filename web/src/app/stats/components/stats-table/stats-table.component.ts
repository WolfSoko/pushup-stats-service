import {
  AsyncPipe,
  DatePipe,
  NgTemplateOutlet,
  isPlatformBrowser,
} from '@angular/common';
import {
  Component,
  PLATFORM_ID,
  TemplateRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRippleModule } from '@angular/material/core';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { PushupRecord } from '@pu-stats/models';
import { UserContextService } from '../../../user-context.service';
import { UserConfigApiService } from '@pu-stats/data-access';
import { firstValueFrom } from 'rxjs';

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
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    MatSortModule,
    MatAutocompleteModule,
    ReactiveFormsModule,
    MatRippleModule,
    ScrollingModule,
  ],
  template: `
    <mat-card class="table-card">
      <mat-card-header>
        <mat-card-title i18n="@@entriesTitle">Einträge</mat-card-title>
        <mat-card-subtitle i18n="@@entriesCount"
          >{{ entries().length }} Einträge</mat-card-subtitle
        >
        <span class="header-spacer"></span>
        <button
          type="button"
          mat-button
          class="toggle-source"
          (click)="toggleSourceColumn()"
          i18n="@@sourceColumnToggle"
        >
          <mat-icon>{{
            showSourceColumn() ? 'visibility' : 'visibility_off'
          }}</mat-icon>
          Quelle
        </button>
      </mat-card-header>

      <mat-card-content>
        @if (isBrowser) {
          <cdk-virtual-scroll-viewport
            class="table-wrap"
            [itemSize]="56"
            [minBufferPx]="280"
            [maxBufferPx]="560"
          >
            <ng-container *ngTemplateOutlet="entriesTable"></ng-container>
          </cdk-virtual-scroll-viewport>
        } @else {
          <div class="table-wrap">
            <ng-container *ngTemplateOutlet="entriesTable"></ng-container>
          </div>
        }

        @if (!entries().length) {
          <p class="empty" i18n="@@noEntriesInSelectedRange">
            Keine Einträge im gewählten Zeitraum.
          </p>
        }
      </mat-card-content>

      <mat-card-actions align="end">
        <button
          type="button"
          class="add-btn"
          mat-flat-button
          (click)="openCreateDialog()"
          i18n="@@createNewEntry"
        >
          <mat-icon>add</mat-icon>
          Neu
        </button>
      </mat-card-actions>
    </mat-card>

    <ng-template #entriesTable>
      <mat-table
        [dataSource]="dataSource"
        matSort
        [matSortActive]="'timestamp'"
        [matSortDirection]="'desc'"
        class="mat-elevation-z8"
      >
        <ng-container matColumnDef="timestamp">
          <mat-header-cell *matHeaderCellDef mat-sort-header i18n="@@colTime"
            >Zeit</mat-header-cell
          >
          <mat-cell *matCellDef="let entry">{{
            entry.timestamp | date: 'dd.MM.yyyy, HH:mm'
          }}</mat-cell>
        </ng-container>

        <ng-container matColumnDef="reps">
          <mat-header-cell *matHeaderCellDef mat-sort-header i18n="@@colReps"
            >Reps</mat-header-cell
          >
          <mat-cell *matCellDef="let entry"
            ><span>{{ entry.reps }}</span></mat-cell
          >
        </ng-container>

        <ng-container matColumnDef="type">
          <mat-header-cell *matHeaderCellDef mat-sort-header i18n="@@colType"
            >Typ</mat-header-cell
          >
          <mat-cell *matCellDef="let entry"
            ><span>{{ entry.type || 'Standard' }}</span></mat-cell
          >
        </ng-container>

        <ng-container matColumnDef="source">
          <mat-header-cell *matHeaderCellDef mat-sort-header i18n="@@colSource"
            >Quelle</mat-header-cell
          >
          <mat-cell *matCellDef="let entry"
            ><span>{{ entry.source }}</span></mat-cell
          >
        </ng-container>

        <ng-container matColumnDef="actions">
          <mat-header-cell *matHeaderCellDef i18n="@@colActions"
            >Aktion</mat-header-cell
          >
          <mat-cell *matCellDef="let entry" class="actions">
            <button
              type="button"
              mat-mini-fab
              aria-label="Bearbeiten"
              i18n-aria-label="@@editAria"
              title="Bearbeiten"
              i18n-title="@@editTitle"
              (click)="openEditDialog(entry)"
            >
              <mat-icon>edit</mat-icon>
            </button>
            <button
              type="button"
              class="danger"
              mat-mini-fab
              aria-label="Löschen"
              i18n-aria-label="@@deleteAria"
              title="Löschen"
              i18n-title="@@deleteTitle"
              [disabled]="isBusy('delete', entry._id)"
              (click)="remove.emit(entry._id)"
            >
              @if (isBusy('delete', entry._id)) {
                <mat-spinner diameter="14"></mat-spinner>
              } @else {
                <mat-icon>delete</mat-icon>
              }
            </button>
          </mat-cell>
        </ng-container>

        <mat-header-row
          *matHeaderRowDef="displayedColumns(); sticky: true"
        ></mat-header-row>
        <mat-row
          matRipple
          *matRowDef="let row; columns: displayedColumns()"
        ></mat-row>
      </mat-table>
    </ng-template>

    <ng-template #createDialog>
      <h2 mat-dialog-title i18n="@@createDialogTitle">Neuen Eintrag anlegen</h2>

      <mat-dialog-content class="create-dialog-content">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@timestampLabel">Zeitpunkt</mat-label>
          <input
            matInput
            type="datetime-local"
            [value]="newTimestamp()"
            (input)="newTimestamp.set(asValue($event))"
            required
          />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@repsLabel">Reps</mat-label>
          <input
            matInput
            type="number"
            min="1"
            [value]="newReps()"
            (input)="newReps.set(asValue($event))"
            required
          />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@typeLabel">Typ</mat-label>
          <input
            type="text"
            matInput
            [formControl]="newTypeControl"
            [matAutocomplete]="typeAuto"
            placeholder="Pick one / Custom"
            i18n-placeholder="@@typePlaceholder"
          />
          <mat-autocomplete #typeAuto="matAutocomplete">
            @for (option of filteredTypeOptions$ | async; track option) {
              <mat-option [value]="option">{{ option }}</mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@sourceLabel">Quelle</mat-label>
          <input
            type="text"
            matInput
            [formControl]="newSourceControl"
            [matAutocomplete]="sourceAuto"
            placeholder="web / whatsapp / Custom"
            i18n-placeholder="@@sourcePlaceholder"
          />
          <mat-autocomplete #sourceAuto="matAutocomplete">
            @for (option of filteredSourceOptions$ | async; track option) {
              <mat-option [value]="option">{{ option }}</mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button
          type="button"
          mat-button
          (click)="dialog.closeAll()"
          i18n="@@cancel"
        >
          Abbrechen
        </button>
        <button
          type="button"
          mat-flat-button
          [disabled]="isCreateBusy()"
          (click)="submitCreate()"
          i18n="@@saveEntry"
        >
          @if (isCreateBusy()) {
            <mat-spinner diameter="14"></mat-spinner>
          } @else {
            Speichern
          }
        </button>
      </mat-dialog-actions>
    </ng-template>

    <ng-template #editDialog>
      <h2 mat-dialog-title i18n="@@editDialogTitle">Eintrag bearbeiten</h2>

      <mat-dialog-content class="create-dialog-content">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@timestampLabel">Zeitpunkt</mat-label>
          <input
            matInput
            type="datetime-local"
            [value]="editTimestampById()"
            (input)="setEditTimestampById(asValue($event))"
            required
          />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@repsLabel">Reps</mat-label>
          <input
            matInput
            type="number"
            min="1"
            [value]="editRepsById()"
            (input)="setEditRepsById(asValue($event))"
            required
          />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@typeLabel">Typ</mat-label>
          <input
            type="text"
            matInput
            [formControl]="editTypeControl"
            [matAutocomplete]="editTypeAuto"
            placeholder="Pick one / Custom"
            i18n-placeholder="@@typePlaceholder"
          />
          <mat-autocomplete #editTypeAuto="matAutocomplete">
            @for (option of filteredEditTypeOptions$ | async; track option) {
              <mat-option [value]="option">{{ option }}</mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label i18n="@@sourceLabel">Quelle</mat-label>
          <input
            type="text"
            matInput
            [formControl]="editSourceControl"
            [matAutocomplete]="editSourceAuto"
            placeholder="web / whatsapp / Custom"
            i18n-placeholder="@@sourcePlaceholder"
          />
          <mat-autocomplete #editSourceAuto="matAutocomplete">
            @for (option of filteredEditSourceOptions$ | async; track option) {
              <mat-option [value]="option">{{ option }}</mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button type="button" mat-button (click)="cancelEdit()" i18n="@@cancel">
          Abbrechen
        </button>
        <button
          type="button"
          mat-flat-button
          [disabled]="!editingId() || isBusy('update', editBusyId())"
          (click)="saveFromDialog()"
          i18n="@@saveChanges"
        >
          @if (editingId() && isBusy('update', editBusyId())) {
            <mat-spinner diameter="14"></mat-spinner>
          } @else {
            Speichern
          }
        </button>
      </mat-dialog-actions>
    </ng-template>
  `,
  styleUrl: './stats-table.component.scss',
})
export class StatsTableComponent {
  readonly dialog = inject(MatDialog);
  private readonly platformId = inject(PLATFORM_ID);
  readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly createDialog = viewChild<TemplateRef<unknown>>('createDialog');
  readonly editDialog = viewChild<TemplateRef<unknown>>('editDialog');
  readonly sort = viewChild(MatSort);

  readonly entries = input<PushupRecord[]>([]);
  readonly busyAction = input<'create' | 'update' | 'delete' | null>(null);
  readonly busyId = input<string | null>(null);

  readonly create = output<{
    timestamp: string;
    reps: number;
    source?: string;
    type?: string;
  }>();
  readonly update = output<{
    id: string;
    timestamp: string;
    reps: number;
    source: string;
    type?: string;
  }>();
  readonly remove = output<string>();

  readonly newTimestamp = signal('');
  readonly newReps = signal('');

  // Autocomplete inputs (allow selecting from options OR entering custom text).
  readonly newTypeControl = new FormControl<string>('Standard', {
    nonNullable: true,
  });
  readonly newSourceControl = new FormControl<string>('web', {
    nonNullable: true,
  });

  readonly typeOptions = [
    'Standard',
    'Diamond',
    'Wide',
    'Archer',
    'Decline',
    'Incline',
    'Pike',
    'Knuckle',
  ];
  // Canonical source values ("wa" is legacy; use "whatsapp").
  readonly sourceOptions = ['web', 'whatsapp'];

  readonly filteredTypeOptions$ = this.newTypeControl.valueChanges.pipe(
    startWith(this.newTypeControl.value),
    map((value) => this.filterOptions(value, this.typeOptions))
  );

  readonly filteredSourceOptions$ = this.newSourceControl.valueChanges.pipe(
    startWith(this.newSourceControl.value),
    map((value) => this.filterOptions(value, this.sourceOptions))
  );

  private readonly user = inject(UserContextService);
  private readonly userConfigApi = inject(UserConfigApiService);

  readonly showSourceColumn = signal(false);

  readonly displayedColumns = computed(() => {
    const base = ['timestamp', 'reps', 'type'];
    const cols = this.showSourceColumn() ? [...base, 'source'] : base;
    return [...cols, 'actions'];
  });

  readonly dataSource = new MatTableDataSource<PushupRecord>([]);

  private readonly editedTimestamp = signal<Record<string, string>>({});
  private readonly editedReps = signal<Record<string, string>>({});
  private readonly editedSource = signal<Record<string, string>>({});
  private readonly editedType = signal<Record<string, string>>({});
  readonly editingId = signal<string | null>(null);

  readonly editTypeControl = new FormControl<string>('Standard', {
    nonNullable: true,
  });
  readonly editSourceControl = new FormControl<string>('web', {
    nonNullable: true,
  });

  readonly filteredEditTypeOptions$ = this.editTypeControl.valueChanges.pipe(
    startWith(this.editTypeControl.value),
    map((value) => this.filterOptions(value, this.typeOptions))
  );

  readonly filteredEditSourceOptions$ =
    this.editSourceControl.valueChanges.pipe(
      startWith(this.editSourceControl.value),
      map((value) => this.filterOptions(value, this.sourceOptions))
    );

  constructor() {
    this.dataSource.sortingDataAccessor = (item, property) => {
      if (property === 'timestamp') return new Date(item.timestamp).getTime();
      if (property === 'reps') return item.reps;
      if (property === 'source') return item.source;
      if (property === 'type') return item.type || 'Standard';
      return '';
    };

    if (this.isBrowser) {
      // Load preference from DB based on active user.
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
    const dialogTpl = this.createDialog();
    if (!dialogTpl) return;
    if (!this.newTimestamp()) {
      this.newTimestamp.set(this.defaultDateTimeLocal());
    }
    this.dialog.open(dialogTpl, {
      width: 'min(92vw, 420px)',
      maxWidth: '92vw',
    });
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  isCreateBusy(): boolean {
    return this.busyAction() === 'create';
  }

  isBusy(action: 'update' | 'delete', id: string): boolean {
    return this.busyAction() === action && this.busyId() === id;
  }

  editBusyId(): string {
    return this.editingId() ?? '';
  }

  isEditing(id: string): boolean {
    return this.editingId() === id;
  }

  openEditDialog(entry: PushupRecord): void {
    const dialogTpl = this.editDialog();
    if (!dialogTpl) return;
    this.startEdit(entry);
    this.dialog.open(dialogTpl, {
      width: 'min(92vw, 420px)',
      maxWidth: '92vw',
    });
  }

  startEdit(entry: PushupRecord): void {
    this.editingId.set(entry._id);

    // Prefer preserving existing timestamp format for <input type="datetime-local">
    // Value must be like YYYY-MM-DDTHH:mm.
    const ts = (entry.timestamp || '').slice(0, 16);
    this.editedTimestamp.update((prev) => ({ ...prev, [entry._id]: ts }));

    this.editedReps.update((prev) => ({
      ...prev,
      [entry._id]: String(entry.reps),
    }));

    const rawSource = entry.source || 'web';
    const source = this.normalizeSource(rawSource);
    this.editedSource.update((prev) => ({ ...prev, [entry._id]: source }));
    this.editSourceControl.setValue(source);

    const type = (entry.type || 'Standard').trim() || 'Standard';
    this.editedType.update((prev) => ({ ...prev, [entry._id]: type }));
    this.editTypeControl.setValue(type);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.dialog.closeAll();
  }

  editTimestamp(entry: PushupRecord): string {
    return (
      this.editedTimestamp()[entry._id] ?? (entry.timestamp || '').slice(0, 16)
    );
  }

  editReps(entry: PushupRecord): string {
    return this.editedReps()[entry._id] ?? String(entry.reps);
  }

  editSource(entry: PushupRecord): string {
    return this.editedSource()[entry._id] ?? entry.source;
  }

  setEditTimestamp(entry: PushupRecord, value: string): void {
    this.editedTimestamp.update((prev) => ({ ...prev, [entry._id]: value }));
  }

  setEditReps(entry: PushupRecord, value: string): void {
    this.editedReps.update((prev) => ({ ...prev, [entry._id]: value }));
  }

  setEditSource(entry: PushupRecord, value: string): void {
    this.editedSource.update((prev) => ({ ...prev, [entry._id]: value }));
  }

  editType(entry: PushupRecord): string {
    return this.editedType()[entry._id] ?? entry.type ?? 'Standard';
  }

  setEditType(entry: PushupRecord, value: string): void {
    this.editedType.update((prev) => ({ ...prev, [entry._id]: value }));
  }

  editTimestampById(): string {
    const id = this.editingId();
    if (!id) return '';
    const entry = this.entries().find((row) => row._id === id);
    return this.editedTimestamp()[id] ?? (entry?.timestamp || '').slice(0, 16);
  }

  setEditTimestampById(value: string): void {
    const id = this.editingId();
    if (!id) return;
    this.editedTimestamp.update((prev) => ({ ...prev, [id]: value }));
  }

  editRepsById(): string {
    const id = this.editingId();
    if (!id) return '';
    const entry = this.entries().find((row) => row._id === id);
    return id ? (this.editedReps()[id] ?? String(entry?.reps ?? '')) : '';
  }

  setEditRepsById(value: string): void {
    const id = this.editingId();
    if (!id) return;
    this.editedReps.update((prev) => ({ ...prev, [id]: value }));
  }

  editSourceById(): string {
    const id = this.editingId();
    if (!id) return '';
    const entry = this.entries().find((row) => row._id === id);
    return this.editedSource()[id] ?? entry?.source ?? '';
  }

  setEditSourceById(value: string): void {
    const id = this.editingId();
    if (!id) return;
    this.editedSource.update((prev) => ({ ...prev, [id]: value }));
  }

  saveFromDialog(): void {
    const id = this.editingId();
    if (!id) return;
    const entry = this.entries().find((row) => row._id === id);
    if (!entry) return;

    const timestamp = this.editTimestampById();
    this.setEditTimestamp(entry, timestamp);

    const type = (this.editTypeControl.value || '').trim() || 'Standard';
    this.setEditType(entry, type);

    const source = this.normalizeSource(
      (this.editSourceControl.value || '').trim() || 'web'
    );
    this.setEditSource(entry, source);

    this.save(entry);
    this.dialog.closeAll();
  }

  submitCreate(): void {
    const reps = Number(this.newReps());
    if (!this.newTimestamp() || Number.isNaN(reps) || reps <= 0) return;

    const type = (this.newTypeControl.value || '').trim() || 'Standard';
    const source = this.normalizeSource(
      (this.newSourceControl.value || '').trim() || 'web'
    );

    this.create.emit({
      timestamp: this.newTimestamp(),
      reps,
      source,
      type,
    });

    this.newReps.set('');
    this.newTypeControl.setValue('Standard');
    this.newSourceControl.setValue('web');
    this.dialog.closeAll();
  }

  private defaultDateTimeLocal(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  save(entry: PushupRecord): void {
    const editedLocal = this.editTimestamp(entry);
    if (!editedLocal) return;

    // Preserve original timestamp string (including seconds/timezone) unless the
    // user actually changed the datetime-local input.
    const defaultLocal = (entry.timestamp || '').slice(0, 16);
    const timestamp =
      entry.timestamp && editedLocal === defaultLocal
        ? entry.timestamp
        : editedLocal;

    const reps = Number(this.editReps(entry));
    if (Number.isNaN(reps) || reps <= 0) return;

    this.update.emit({
      id: entry._id,
      timestamp,
      reps,
      source: this.editSource(entry) || 'web',
      type: this.editType(entry) || 'Standard',
    });
    this.editingId.set(null);
  }

  private filterOptions(
    value: string | null | undefined,
    options: string[]
  ): string[] {
    const needle = (value ?? '').toLowerCase().trim();
    if (!needle) return options;
    return options.filter((opt) => opt.toLowerCase().includes(needle));
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

  private normalizeSource(value: string): string {
    const v = (value || '').trim();
    if (!v) return 'web';
    if (v === 'wa') return 'whatsapp';
    return v;
  }
}
