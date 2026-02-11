import { DatePipe } from '@angular/common';
import { AfterViewInit, Component, TemplateRef, ViewChild, effect, inject, input, output, signal } from '@angular/core';
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
import { MatSelectModule } from '@angular/material/select';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { PushupRecord } from '@nx-temp/stats-models';

@Component({
  selector: 'app-stats-table',
  imports: [
    MatCardModule,
    MatProgressSpinnerModule,
    DatePipe,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    MatSortModule,
    MatSelectModule,
    MatRippleModule,
    ScrollingModule,
  ],
  template: `
    <mat-card class="table-card">
      <mat-card-header>
        <mat-card-title>Einträge</mat-card-title>
        <mat-card-subtitle>{{ entries().length }} Einträge</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <cdk-virtual-scroll-viewport class="table-wrap" [itemSize]="56" [minBufferPx]="280" [maxBufferPx]="560">
          <mat-table
            [dataSource]="dataSource"
            matSort
            [matSortActive]="'timestamp'"
            [matSortDirection]="'desc'"
            class="mat-elevation-z8"
          >
          <ng-container matColumnDef="timestamp">
            <mat-header-cell *matHeaderCellDef mat-sort-header>Zeit</mat-header-cell>
            <mat-cell *matCellDef="let entry">{{ entry.timestamp | date: 'dd.MM.yyyy, HH:mm' }}</mat-cell>
          </ng-container>

          <ng-container matColumnDef="reps">
            <mat-header-cell *matHeaderCellDef mat-sort-header>Reps</mat-header-cell>
            <mat-cell *matCellDef="let entry"><span>{{ entry.reps }}</span></mat-cell>
          </ng-container>

          <ng-container matColumnDef="source">
            <mat-header-cell *matHeaderCellDef mat-sort-header>Quelle</mat-header-cell>
            <mat-cell *matCellDef="let entry"><span>{{ entry.source }}</span></mat-cell>
          </ng-container>

          <ng-container matColumnDef="type">
            <mat-header-cell *matHeaderCellDef mat-sort-header>Typ</mat-header-cell>
            <mat-cell *matCellDef="let entry"><span>{{ entry.type || 'Standard' }}</span></mat-cell>
          </ng-container>

          <ng-container matColumnDef="actions">
            <mat-header-cell *matHeaderCellDef>Aktion</mat-header-cell>
            <mat-cell *matCellDef="let entry" class="actions">
              <button type="button" mat-mini-fab aria-label="Bearbeiten" title="Bearbeiten" (click)="openEditDialog(entry)">
                <mat-icon>edit</mat-icon>
              </button>
              <button
                type="button"
                class="danger"
                mat-mini-fab
                aria-label="Löschen"
                title="Löschen"
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

          <mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></mat-header-row>
          <mat-row matRipple *matRowDef="let row; columns: displayedColumns"></mat-row>
        </mat-table>

          @if (!entries().length) {
            <p class="empty">Keine Einträge im gewählten Zeitraum.</p>
          }
        </cdk-virtual-scroll-viewport>
      </mat-card-content>

      <mat-card-actions align="end">
        <button type="button" class="add-btn" mat-flat-button (click)="openCreateDialog()">
          <mat-icon>add</mat-icon>
          Neu
        </button>
      </mat-card-actions>
    </mat-card>

    <ng-template #createDialog>
      <h2 mat-dialog-title>Neuen Eintrag anlegen</h2>

      <mat-dialog-content class="create-dialog-content">
        <mat-form-field appearance="outline">
          <mat-label>Zeitpunkt</mat-label>
          <input matInput type="datetime-local" [value]="newTimestamp()" (input)="newTimestamp.set(asValue($event))" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Reps</mat-label>
          <input matInput type="number" min="1" [value]="newReps()" (input)="newReps.set(asValue($event))" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Typ</mat-label>
          <mat-select [value]="newType()" (valueChange)="newType.set($event)">
            @for (typeOption of typeOptions; track typeOption) {
              <mat-option [value]="typeOption">{{ typeOption }}</mat-option>
            }
            <mat-option value="Custom">Custom</mat-option>
          </mat-select>
        </mat-form-field>

        @if (newType() === 'Custom') {
          <mat-form-field appearance="outline">
            <mat-label>Eigener Typ</mat-label>
            <input matInput type="text" [value]="newTypeCustom()" (input)="newTypeCustom.set(asValue($event))" />
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Quelle</mat-label>
          <input matInput type="text" [value]="newSource()" (input)="newSource.set(asValue($event))" />
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button type="button" mat-button (click)="dialog.closeAll()">Abbrechen</button>
        <button type="button" mat-flat-button [disabled]="isCreateBusy()" (click)="submitCreate()">
          @if (isCreateBusy()) {
            <mat-spinner diameter="14"></mat-spinner>
          } @else {
            Speichern
          }
        </button>
      </mat-dialog-actions>
    </ng-template>

    <ng-template #editDialog>
      <h2 mat-dialog-title>Eintrag bearbeiten</h2>

      <mat-dialog-content class="create-dialog-content">
        <mat-form-field appearance="outline">
          <mat-label>Reps</mat-label>
          <input matInput type="number" min="1" [value]="editRepsById()" (input)="setEditRepsById(asValue($event))" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Typ</mat-label>
          <mat-select [value]="editTypeMode()" (valueChange)="editTypeMode.set($event)">
            @for (typeOption of typeOptions; track typeOption) {
              <mat-option [value]="typeOption">{{ typeOption }}</mat-option>
            }
            <mat-option value="Custom">Custom</mat-option>
          </mat-select>
        </mat-form-field>

        @if (editTypeMode() === 'Custom') {
          <mat-form-field appearance="outline">
            <mat-label>Eigener Typ</mat-label>
            <input matInput type="text" [value]="editTypeCustom()" (input)="editTypeCustom.set(asValue($event))" />
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Quelle</mat-label>
          <input matInput type="text" [value]="editSourceById()" (input)="setEditSourceById(asValue($event))" />
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button type="button" mat-button (click)="cancelEdit()">Abbrechen</button>
        <button type="button" mat-flat-button [disabled]="!editingId() || isBusy('update', editBusyId())" (click)="saveFromDialog()">
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
export class StatsTableComponent implements AfterViewInit {
  readonly dialog = inject(MatDialog);

  @ViewChild('createDialog') createDialog?: TemplateRef<unknown>;
  @ViewChild('editDialog') editDialog?: TemplateRef<unknown>;
  @ViewChild(MatSort) sort?: MatSort;

  readonly entries = input<PushupRecord[]>([]);
  readonly busyAction = input<'create' | 'update' | 'delete' | null>(null);
  readonly busyId = input<string | null>(null);

  readonly create = output<{ timestamp: string; reps: number; source?: string; type?: string }>();
  readonly update = output<{ id: string; reps: number; source: string; type?: string }>();
  readonly remove = output<string>();

  readonly newTimestamp = signal('');
  readonly newReps = signal('');
  readonly newSource = signal('web');
  readonly newType = signal('Standard');
  readonly newTypeCustom = signal('');
  readonly typeOptions = ['Standard', 'Diamond', 'Wide', 'Archer', 'Decline', 'Incline', 'Pike', 'Knuckle'];

  readonly displayedColumns = ['timestamp', 'reps', 'source', 'type', 'actions'];
  readonly dataSource = new MatTableDataSource<PushupRecord>([]);

  private readonly editedReps = signal<Record<string, string>>({});
  private readonly editedSource = signal<Record<string, string>>({});
  private readonly editedType = signal<Record<string, string>>({});
  readonly editingId = signal<string | null>(null);
  readonly editTypeMode = signal('Standard');
  readonly editTypeCustom = signal('');

  constructor() {
    this.dataSource.sortingDataAccessor = (item, property) => {
      if (property === 'timestamp') return new Date(item.timestamp).getTime();
      if (property === 'reps') return item.reps;
      if (property === 'source') return item.source;
      if (property === 'type') return item.type || 'Standard';
      return '';
    };

    effect(() => {
      this.dataSource.data = this.entries();
    });
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.dataSource.sort = this.sort;
    }
  }

  openCreateDialog(): void {
    if (!this.createDialog) return;
    if (!this.newTimestamp()) {
      this.newTimestamp.set(this.defaultDateTimeLocal());
    }
    this.dialog.open(this.createDialog, { width: 'min(92vw, 420px)', maxWidth: '92vw' });
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
    if (!this.editDialog) return;
    this.startEdit(entry);
    this.dialog.open(this.editDialog, { width: 'min(92vw, 420px)', maxWidth: '92vw' });
  }

  startEdit(entry: PushupRecord): void {
    this.editingId.set(entry._id);
    this.editedReps.update((prev) => ({ ...prev, [entry._id]: String(entry.reps) }));
    this.editedSource.update((prev) => ({ ...prev, [entry._id]: entry.source }));

    const type = entry.type || 'Standard';
    this.editedType.update((prev) => ({ ...prev, [entry._id]: type }));
    if (this.typeOptions.includes(type)) {
      this.editTypeMode.set(type);
      this.editTypeCustom.set('');
    } else {
      this.editTypeMode.set('Custom');
      this.editTypeCustom.set(type);
    }
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.dialog.closeAll();
  }

  editReps(entry: PushupRecord): string {
    return this.editedReps()[entry._id] ?? String(entry.reps);
  }

  editSource(entry: PushupRecord): string {
    return this.editedSource()[entry._id] ?? entry.source;
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

  editRepsById(): string {
    const id = this.editingId();
    if (!id) return '';
    const entry = this.entries().find((row) => row._id === id);
    return id ? this.editedReps()[id] ?? String(entry?.reps ?? '') : '';
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

    const type = this.editTypeMode() === 'Custom' ? this.editTypeCustom().trim() || 'Custom' : this.editTypeMode();
    this.setEditType(entry, type);
    this.save(entry);
    this.dialog.closeAll();
  }

  submitCreate(): void {
    const reps = Number(this.newReps());
    if (!this.newTimestamp() || Number.isNaN(reps) || reps <= 0) return;

    this.create.emit({
      timestamp: this.newTimestamp(),
      reps,
      source: this.newSource() || 'web',
      type: this.resolvedNewType(),
    });

    this.newReps.set('');
    this.newTypeCustom.set('');
    this.dialog.closeAll();
  }

  private defaultDateTimeLocal(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  save(entry: PushupRecord): void {
    const reps = Number(this.editReps(entry));
    if (Number.isNaN(reps) || reps <= 0) return;
    this.update.emit({
      id: entry._id,
      reps,
      source: this.editSource(entry) || 'web',
      type: this.editType(entry) || 'Standard',
    });
    this.editingId.set(null);
  }

  private resolvedNewType(): string {
    if (this.newType() !== 'Custom') return this.newType();
    const custom = this.newTypeCustom().trim();
    return custom || 'Custom';
  }
}
