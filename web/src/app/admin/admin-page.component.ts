import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DeleteUserDialogComponent } from './delete-user-dialog.component';
import { UserDetailsDialogComponent } from './user-details-dialog.component';
import { AdminFeedbackSectionComponent } from './admin-feedback-section.component';
import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { AdminUser, BulkDeleteResult } from './admin-page.models';
import {
  adminUserSortValue,
  errorMessage,
  filterAdminUsers,
} from './admin-page.helpers';

@Component({
  selector: 'app-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatTableModule,
    MatTooltipModule,
    MatSlideToggleModule,
    PageHeaderComponent,
    RouterLink,
    AdminFeedbackSectionComponent,
  ],
  templateUrl: './admin-page.component.html',
  styleUrl: './admin-page.component.scss',
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

  readonly refreshTooltip = $localize`:@@admin.refresh:Neu laden`;
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly users = signal<AdminUser[]>([]);
  readonly showOnlyAnonymous = signal(false);
  readonly inactiveDays = signal(20);
  readonly bulkLoading = signal(false);
  readonly bulkError = signal<string | null>(null);
  readonly bulkResult = signal<BulkDeleteResult | null>(null);

  readonly filteredUsers = computed(() =>
    filterAdminUsers(this.users(), this.showOnlyAnonymous())
  );

  readonly usersDataSource = new MatTableDataSource<AdminUser>([]);
  private readonly usersSort = viewChild<MatSort>('usersSort');

  constructor() {
    this.usersDataSource.sortingDataAccessor = adminUserSortValue;

    effect(() => {
      this.usersDataSource.data = this.filteredUsers();
    });
    effect(() => {
      const s = this.usersSort();
      if (s) this.usersDataSource.sort = s;
    });

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
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  openDetailsDialog(user: AdminUser): void {
    this.dialog.open(UserDetailsDialogComponent, {
      data: user,
      width: 'min(92vw, 480px)',
      maxWidth: '92vw',
    });
  }

  detailsAriaLabel(user: AdminUser): string {
    const identifier = user.displayName ?? user.email ?? user.uid;
    return $localize`:@@admin.row.detailsAria:Details öffnen für ${identifier}:identifier:`;
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
      this.error.set(errorMessage(err));
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
      this.bulkError.set(errorMessage(err));
    } finally {
      this.bulkLoading.set(false);
    }
  }
}
