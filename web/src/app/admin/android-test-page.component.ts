import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { AdminUser } from './admin-page.models';
import { errorMessage } from './admin-page.helpers';
import {
  androidTestEmailsForClipboard,
  groupByAndroidTestStatus,
} from './android-test-page.helpers';
import { CallableFunctionsService } from './callable-functions.service';

@Component({
  selector: 'app-android-test-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    PageHeaderComponent,
  ],
  templateUrl: './android-test-page.component.html',
  styleUrl: './android-test-page.component.scss',
})
export class AndroidTestPageComponent {
  private readonly callables = inject(CallableFunctionsService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly users = signal<AdminUser[]>([]);
  readonly busyUid = signal<string | null>(null);
  readonly scanning = signal(false);
  readonly scanResult = signal<number | null>(null);
  readonly emailsCopied = signal(false);

  readonly groups = computed(() => groupByAndroidTestStatus(this.users()));
  readonly clipboardEmails = computed(() =>
    androidTestEmailsForClipboard(this.groups().optedIn)
  );

  constructor() {
    void this.loadUsers();
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const fn = this.callables.call<void, AdminUser[]>('adminListUsers');
      const result = await fn();
      this.users.set(result.data);
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  async computeCandidates(): Promise<void> {
    this.scanning.set(true);
    this.error.set(null);
    this.scanResult.set(null);
    try {
      const fn = this.callables.call<void, { found: number }>(
        'adminComputeAndroidTestCandidates'
      );
      const result = await fn();
      this.scanResult.set(result.data.found);
      await this.loadUsers();
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.scanning.set(false);
    }
  }

  async confirm(uid: string, confirmed: boolean): Promise<void> {
    this.busyUid.set(uid);
    this.error.set(null);
    try {
      const fn = this.callables.call<
        { uid: string; confirmed: boolean },
        { ok: boolean }
      >('adminConfirmAndroidTestCandidate');
      await fn({ uid, confirmed });
      await this.loadUsers();
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.busyUid.set(null);
    }
  }

  async markAdded(uid: string): Promise<void> {
    this.busyUid.set(uid);
    this.error.set(null);
    try {
      const fn = this.callables.call<
        { uid: string },
        { ok: boolean; pushSent: boolean }
      >('adminMarkAndroidTesterAdded');
      const result = await fn({ uid });
      // `loadUsers()` resets `error` on entry, so the pushSent warning must be
      // set *after* it resolves — otherwise the refresh silently clears it.
      await this.loadUsers();
      if (!result.data.pushSent) {
        this.error.set(
          $localize`:@@admin.androidTest.noPush:Kein aktives Push-Abo — Nutzer bitte manuell informieren.`
        );
      }
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.busyUid.set(null);
    }
  }

  async copyEmails(): Promise<void> {
    const text = this.clipboardEmails();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.emailsCopied.set(true);
      setTimeout(() => this.emailsCopied.set(false), 2000);
    } catch (err) {
      this.error.set(errorMessage(err));
    }
  }
}
