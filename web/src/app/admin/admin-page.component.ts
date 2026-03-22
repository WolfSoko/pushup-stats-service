import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DeleteUserDialogComponent } from './delete-user-dialog.component';

export interface AdminUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  anonymous: boolean;
  pushupCount: number;
  lastEntry: string | null;
  createdAt: string | null;
  role: string | null;
}

@Component({
  selector: 'app-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
    MatSlideToggleModule,
  ],
  template: `
    <div class="admin-page">
      <h1 i18n="@@admin.title">Admin-Bereich</h1>

      <!-- Bulk action card -->
      <mat-card class="bulk-card">
        <mat-card-header>
          <mat-card-title i18n="@@admin.bulk.title"
            >Anonyme Benutzer aufräumen</mat-card-title
          >
        </mat-card-header>
        <mat-card-content>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@admin.bulk.daysLabel"
              >Inaktiv seit (Tage)</mat-label
            >
            <input
              matInput
              type="number"
              [ngModel]="inactiveDays()"
              (ngModelChange)="inactiveDays.set(+$event)"
              min="1"
            />
          </mat-form-field>
          <p class="bulk-hint">
            Löscht anonyme Benutzer ohne Pushups in den letzten
            {{ inactiveDays() }} Tagen.
            @if (inactiveUserCount() > 0) {
              <strong class="inactive-count">
                ({{ inactiveUserCount() }} betroffene User)
              </strong>
            }
          </p>
        </mat-card-content>
        <mat-card-actions>
          <button
            mat-flat-button
            color="warn"
            class="bulk-btn"
            [disabled]="bulkLoading()"
            (click)="bulkDelete()"
          >
            @if (bulkLoading()) {
              <mat-spinner diameter="18" class="btn-spinner" />
              <span i18n="@@admin.bulk.button">Inaktive löschen</span>
            } @else {
              <mat-icon>delete_sweep</mat-icon>
              <span i18n="@@admin.bulk.button">Inaktive löschen</span>
            }
          </button>
        </mat-card-actions>
        @if (bulkResult()) {
          <mat-card-content>
            <p class="bulk-result success-text">
              ✓ Gelöscht: {{ bulkResult()!.deleted }} | Übersprungen:
              {{ bulkResult()!.skipped }}
            </p>
          </mat-card-content>
        }
        @if (bulkError()) {
          <mat-card-content>
            <p class="error-text">⚠ {{ bulkError() }}</p>
          </mat-card-content>
        }
      </mat-card>

      <!-- Filter toggle -->
      <div class="filter-row">
        <mat-slide-toggle
          [ngModel]="showOnlyAnonymous()"
          (ngModelChange)="showOnlyAnonymous.set($event)"
          i18n="@@admin.filter.anonymous"
        >
          Nur anonyme Benutzer
        </mat-slide-toggle>
        <button
          mat-icon-button
          (click)="loadUsers()"
          [matTooltip]="'Neu laden'"
        >
          <mat-icon>refresh</mat-icon>
        </button>
      </div>

      @if (loading()) {
        <div class="spinner-container">
          <mat-spinner />
        </div>
      } @else if (error()) {
        <p class="error-text">{{ error() }}</p>
      } @else {
        <mat-card>
          <mat-table [dataSource]="filteredUsers()">
            <!-- UID column -->
            <ng-container matColumnDef="uid">
              <mat-header-cell *matHeaderCellDef i18n="@@admin.col.uid"
                >UID</mat-header-cell
              >
              <mat-cell *matCellDef="let u">
                <span [matTooltip]="u.uid" class="uid-chip">{{
                  u.uid.slice(0, 8)
                }}</span>
              </mat-cell>
            </ng-container>

            <!-- displayName column -->
            <ng-container matColumnDef="displayName">
              <mat-header-cell *matHeaderCellDef i18n="@@admin.col.name"
                >Name</mat-header-cell
              >
              <mat-cell *matCellDef="let u">{{
                u.displayName ?? '–'
              }}</mat-cell>
            </ng-container>

            <!-- email column -->
            <ng-container matColumnDef="email">
              <mat-header-cell *matHeaderCellDef i18n="@@admin.col.email"
                >E-Mail</mat-header-cell
              >
              <mat-cell *matCellDef="let u">{{ u.email ?? '–' }}</mat-cell>
            </ng-container>

            <!-- anonymous column -->
            <ng-container matColumnDef="anonymous">
              <mat-header-cell *matHeaderCellDef i18n="@@admin.col.anon"
                >Anon</mat-header-cell
              >
              <mat-cell *matCellDef="let u">
                @if (u.anonymous) {
                  <mat-icon [matTooltip]="'Anonym'" color="warn"
                    >person_outline</mat-icon
                  >
                }
              </mat-cell>
            </ng-container>

            <!-- pushupCount column -->
            <ng-container matColumnDef="pushupCount">
              <mat-header-cell *matHeaderCellDef i18n="@@admin.col.pushups"
                >Pushups</mat-header-cell
              >
              <mat-cell *matCellDef="let u">{{ u.pushupCount }}</mat-cell>
            </ng-container>

            <!-- lastEntry column -->
            <ng-container matColumnDef="lastEntry">
              <mat-header-cell *matHeaderCellDef i18n="@@admin.col.lastEntry"
                >Letzter Eintrag</mat-header-cell
              >
              <mat-cell *matCellDef="let u">{{
                u.lastEntry | date: 'dd.MM.yy'
              }}</mat-cell>
            </ng-container>

            <!-- createdAt column -->
            <ng-container matColumnDef="createdAt">
              <mat-header-cell *matHeaderCellDef i18n="@@admin.col.createdAt"
                >Erstellt</mat-header-cell
              >
              <mat-cell *matCellDef="let u">{{
                u.createdAt | date: 'dd.MM.yy'
              }}</mat-cell>
            </ng-container>

            <!-- actions column -->
            <ng-container matColumnDef="actions">
              <mat-header-cell *matHeaderCellDef></mat-header-cell>
              <mat-cell *matCellDef="let u">
                <button
                  mat-icon-button
                  color="warn"
                  (click)="openDeleteDialog(u)"
                  [matTooltip]="'Benutzer löschen'"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </mat-cell>
            </ng-container>

            <mat-header-row *matHeaderRowDef="displayedColumns" />
            <mat-row *matRowDef="let row; columns: displayedColumns" />
          </mat-table>
        </mat-card>
      }
    </div>
  `,
  styles: `
    .admin-page {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      margin-bottom: 24px;
    }
    .bulk-card {
      margin-bottom: 24px;
    }
    .bulk-card mat-form-field {
      margin-top: 16px;
    }
    .bulk-hint {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.85em;
      margin-top: 8px;
    }
    .inactive-count {
      color: var(--mat-sys-error);
    }
    .bulk-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-spinner {
      display: inline-block;
    }
    .bulk-result {
      font-weight: 500;
    }
    .success-text {
      color: #4caf50;
    }
    .filter-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .spinner-container {
      display: flex;
      justify-content: center;
      padding: 48px;
    }
    .error-text {
      color: var(--mat-sys-error);
    }
    .uid-chip {
      font-family: monospace;
      font-size: 0.85em;
      background: var(--mat-sys-surface-variant);
      padding: 2px 6px;
      border-radius: 4px;
    }
    mat-table {
      width: 100%;
    }
  `,
})
export class AdminPageComponent {
  private readonly functions = inject(Functions);
  private readonly dialog = inject(MatDialog);

  readonly displayedColumns = [
    'uid',
    'displayName',
    'email',
    'anonymous',
    'pushupCount',
    'lastEntry',
    'createdAt',
    'actions',
  ];

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly users = signal<AdminUser[]>([]);
  readonly showOnlyAnonymous = signal(false);
  readonly inactiveDays = signal(20);
  readonly bulkLoading = signal(false);
  readonly bulkError = signal<string | null>(null);
  readonly bulkResult = signal<{ deleted: number; skipped: number } | null>(
    null
  );

  readonly filteredUsers = computed(() =>
    this.showOnlyAnonymous()
      ? this.users().filter((u) => u.anonymous)
      : this.users()
  );

  readonly inactiveUserCount = computed(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.inactiveDays());
    return this.users().filter((u) => {
      if (!u.anonymous) return false;
      if (!u.lastEntry) return true;
      return new Date(u.lastEntry) < cutoff;
    }).length;
  });

  constructor() {
    this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const fn = httpsCallable<void, AdminUser[]>(
        this.functions,
        'adminListUsers'
      );
      const result = await fn();
      this.users.set(result.data);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async openDeleteDialog(user: AdminUser): Promise<void> {
    const ref = this.dialog.open(DeleteUserDialogComponent, {
      data: user,
      width: '420px',
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    try {
      const fn = httpsCallable(this.functions, 'adminDeleteUser');
      await fn({ uid: user.uid, anonymize: result.anonymize });
      this.users.update((list) => list.filter((u) => u.uid !== user.uid));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  async bulkDelete(): Promise<void> {
    this.bulkLoading.set(true);
    this.bulkError.set(null);
    this.bulkResult.set(null);
    try {
      const fn = httpsCallable<
        { inactiveDays: number },
        { deleted: number; skipped: number }
      >(this.functions, 'adminBulkDeleteInactiveAnonymous');
      const result = await fn({ inactiveDays: this.inactiveDays() });
      this.bulkResult.set(result.data);
      // Refresh user list after bulk delete
      await this.loadUsers();
    } catch (err) {
      this.bulkError.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.bulkLoading.set(false);
    }
  }
}
