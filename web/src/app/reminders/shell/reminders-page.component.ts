import { Component, computed, effect, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import {
  ReminderStore,
  ReminderService,
  ReminderPermissionService,
} from '@pu-reminders/reminders';
import { PushSubscriptionService } from '@pu-push/push';
import { UnsubscribeAllDevicesDialogComponent } from './unsubscribe-all-devices-dialog.component';
import { ReminderFormStore } from './reminder-form.store';
import { ReminderSettingsSectionComponent } from './reminder-settings-section.component';
import { PushStatusPanelComponent } from './push-status-panel.component';
import { UnsubscribeAllSectionComponent } from './unsubscribe-all-section.component';
import {
  resolveTimezone,
  shouldAutoSubscribePush,
} from './reminders-page.helpers';
import { PageHeaderComponent } from '../../core/page-header/page-header.component';

@Component({
  selector: 'app-reminders-page',
  providers: [ReminderFormStore],
  imports: [
    MatCardModule,
    MatSnackBarModule,
    PageHeaderComponent,
    ReminderSettingsSectionComponent,
    PushStatusPanelComponent,
    UnsubscribeAllSectionComponent,
  ],
  template: `
    <main class="page-wrap">
      <app-page-header icon="notifications_active" variant="reminders">
        <h1 page-title i18n="@@remindersHeaderTitle">Erinnerungen</h1>
        <p page-subtitle i18n="@@remindersHeaderSubtitle">
          Push-Benachrichtigungen, Zeiten und Geräte verwalten.
        </p>
      </app-page-header>
      <mat-card>
        <mat-card-content>
          <app-reminder-settings-section
            [permissionStatus]="reminderStore.permissionStatus()"
            (reminderToggle)="onReminderToggle($event)"
            (save)="saveReminderSettings()"
          />

          <app-push-status-panel
            [status]="pushService.status()"
            [deviceCount]="pushService.deviceCount()"
            (subscribe)="onPushSubscribe()"
            (unsubscribe)="onPushUnsubscribe()"
          />

          @if (canUnsubscribeAllDevices()) {
            <app-unsubscribe-all-section
              [loading]="authStore.loading()"
              (unsubscribeAll)="onUnsubscribeAllDevices()"
            />
          }
        </mat-card-content>
      </mat-card>
    </main>
  `,
  styles: `
    .page-wrap {
      max-width: 900px;
      margin: 0 auto;
      padding: 16px;
      display: grid;
      gap: 12px;
    }
  `,
})
export class RemindersPageComponent {
  private readonly user = inject(UserContextService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  readonly reminderStore = inject(ReminderStore);
  readonly authStore = inject(AuthStore);
  private readonly reminderPermission = inject(ReminderPermissionService);
  private readonly reminderService = inject(ReminderService);
  readonly pushService = inject(PushSubscriptionService);
  readonly form = inject(ReminderFormStore);

  readonly activeUserId = this.user.userIdSafe;
  readonly canUnsubscribeAllDevices = computed(() =>
    this.authStore.isAuthenticated()
  );

  constructor() {
    void this.pushService.init();

    // Sync form draft from global store — but don't overwrite unsaved edits
    // (config loads async and can arrive after the user already toggled the form)
    effect(() => {
      const rc = this.reminderStore.config();
      this.form.syncIfClean(rc);
    });
  }

  // ── Push methods ──────────────────────────────────────────────────────────

  async onPushSubscribe(): Promise<void> {
    const ok = await this.pushService.subscribe();
    if (!ok && this.pushService.status() !== 'denied') {
      this.snackBar.open(
        $localize`:@@push.subscribe.error:Push konnte nicht aktiviert werden.`,
        $localize`:@@snackbar.close:Schließen`,
        { duration: 4000 }
      );
    }
  }

  async onPushUnsubscribe(): Promise<void> {
    await this.pushService.unsubscribe();
  }

  // ── Unsubscribe all devices ───────────────────────────────────────────────

  async onUnsubscribeAllDevices(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open<
          UnsubscribeAllDevicesDialogComponent,
          void,
          boolean
        >(UnsubscribeAllDevicesDialogComponent)
        .afterClosed()
    );
    if (!confirmed) return;

    const ok = await this.authStore.unsubscribeAllPushDevices();
    if (!ok) {
      this.snackBar.open(
        $localize`:@@unsubAll.error:Entfernen der Push-Abos fehlgeschlagen.`,
        $localize`:@@snackbar.close:Schließen`,
        { duration: 5000 }
      );
      return;
    }

    // Server-side records are wiped by the Cloud Function. Also drop the
    // browser-side subscription on this device so the push status UI reflects
    // reality immediately and the service worker doesn't keep a stale
    // subscription around.
    if (this.pushService.status() === 'subscribed') {
      await this.pushService.unsubscribe();
    }

    this.snackBar.open(
      $localize`:@@unsubAll.success:Push-Abos aller Geräte entfernt.`,
      $localize`:@@snackbar.close:Schließen`,
      { duration: 4000 }
    );
  }

  // ── Reminder methods ──────────────────────────────────────────────────────

  async onReminderToggle(enabled: boolean): Promise<void> {
    if (enabled && this.reminderPermission.status() !== 'granted') {
      const result = await this.reminderPermission.requestPermission();
      if (result !== 'granted') {
        const status = this.reminderPermission.status();
        if (status !== 'unsupported') {
          this.snackBar.open(
            $localize`:@@reminder.permission.snackbar:Benachrichtigungen sind blockiert. Bitte in den Browser-Einstellungen erlauben.`,
            $localize`:@@snackbar.close:Schließen`,
            { duration: 5000 }
          );
        }
        return;
      }
    }
    this.form.setEnabled(enabled);
  }

  async saveReminderSettings(): Promise<void> {
    const userId = this.activeUserId();
    this.form.clampInterval();
    if (this.form.quickLogEnabled()) {
      this.form.clampQuickLogReps();
    }
    if (!userId) {
      this.snackBar.open(
        $localize`:@@reminder.save.error:Einstellungen konnten nicht gespeichert werden.`,
        $localize`:@@snackbar.close:Schließen`,
        { duration: 5000 }
      );
      return;
    }
    const timezone = resolveTimezone(this.reminderStore.config()?.timezone);
    const config = this.form.toConfig(timezone);
    // Capture before saveConfig() overwrites the store state
    const wasEnabled = this.reminderStore.config()?.enabled ?? false;
    this.form.setSaving(true);
    try {
      await this.reminderStore.saveConfig(userId, config);
      const err = this.reminderStore.error();
      if (err) {
        this.snackBar.open(
          $localize`:@@reminder.save.error:Einstellungen konnten nicht gespeichert werden.`,
          $localize`:@@snackbar.close:Schließen`,
          { duration: 5000 }
        );
        return;
      }
      if (config.enabled) {
        if (shouldAutoSubscribePush(wasEnabled, this.pushService.status())) {
          await this.pushService.subscribe();
          const pushStatus = this.pushService.status();
          if (pushStatus !== 'subscribed' && pushStatus !== 'denied') {
            this.snackBar.open(
              $localize`:@@push.subscribe.error:Push konnte nicht aktiviert werden.`,
              $localize`:@@snackbar.close:Schließen`,
              { duration: 5000 }
            );
          }
          // Still allow reminders to be saved — in-app notifications
          // work as a fallback even without a push subscription.
        }
        this.reminderService.start({
          userId,
          displayName: this.user.userNameSafe() || undefined,
        });
      } else {
        this.reminderService.stop();
      }
      this.form.markSaved();
      setTimeout(() => this.form.clearSaved(), 1500);
    } finally {
      this.form.setSaving(false);
    }
  }
}
