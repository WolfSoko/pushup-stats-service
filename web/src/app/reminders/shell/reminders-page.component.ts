import { Component, effect, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { UserContextService } from '@pu-auth/auth';
import type { ReminderConfig } from '@pu-stats/models';
import {
  ReminderStore,
  ReminderService,
  ReminderPermissionService,
  PushSubscriptionService,
} from '@pu-reminders/reminders';

@Component({
  selector: 'app-reminders-page',
  imports: [
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
  ],
  template: `
    <main class="page-wrap">
      <mat-card>
        <mat-card-header>
          <mat-card-title i18n="@@reminders.page.title"
            >🔔 Erinnerungen</mat-card-title
          >
          <mat-card-subtitle i18n="@@reminders.page.subtitle"
            >Liegestütz-Erinnerungen &
            Push-Benachrichtigungen</mat-card-subtitle
          >
        </mat-card-header>

        <mat-card-content>
          <section class="reminder-section">
            <h3 i18n="@@reminder.section.title">🔔 Erinnerungen / Reminders</h3>

            <div class="reminder-row">
              <mat-slide-toggle
                [checked]="reminderEnabledDraft()"
                (change)="onReminderToggle($event.checked)"
                i18n="@@reminder.enabled.label"
              >
                Liegestütz-Erinnerungen aktivieren
              </mat-slide-toggle>

              @if (reminderStore.permissionStatus() === 'denied') {
                <span
                  class="permission-hint"
                  i18n="@@reminder.permission.denied.hint"
                >
                  <mat-icon>warning</mat-icon>
                  Benachrichtigungen sind im Browser blockiert. Bitte in den
                  Browser-Einstellungen erlauben.
                </span>
              } @else if (reminderStore.permissionStatus() === 'granted') {
                <span class="permission-ok">
                  <mat-icon>check_circle</mat-icon>
                  <span i18n="@@reminder.permission.granted"
                    >Benachrichtigungen erlaubt</span
                  >
                </span>
              } @else if (reminderStore.permissionStatus() === 'unsupported') {
                <span
                  class="permission-hint"
                  i18n="@@reminder.permission.unsupported"
                >
                  <mat-icon>info</mat-icon>
                  Dein Browser unterstützt keine Benachrichtigungen.
                </span>
              }
            </div>

            @if (reminderEnabledDraft()) {
              <div class="reminder-grid">
                <div>
                  <p class="field-label" i18n="@@reminder.interval.label">
                    Erinnerungsintervall
                  </p>
                  <mat-chip-listbox
                    [value]="reminderIntervalDraft()"
                    [disabled]="reminderSaving()"
                    (change)="
                      reminderIntervalDraft.set($event.value);
                      reminderDirty.set(true)
                    "
                    aria-label="Intervall-Voreinstellungen"
                    i18n-aria-label="@@reminder.interval.aria"
                  >
                    <mat-chip-option
                      [value]="30"
                      i18n="@@reminder.interval.30min"
                      >30 Min</mat-chip-option
                    >
                    <mat-chip-option [value]="60" i18n="@@reminder.interval.1h"
                      >1 Std</mat-chip-option
                    >
                    <mat-chip-option [value]="120" i18n="@@reminder.interval.2h"
                      >2 Std</mat-chip-option
                    >
                    <mat-chip-option [value]="240" i18n="@@reminder.interval.4h"
                      >4 Std</mat-chip-option
                    >
                  </mat-chip-listbox>

                  <mat-form-field appearance="outline" class="interval-custom">
                    <mat-label i18n="@@reminder.interval.custom.label"
                      >Benutzerdefiniert (Min)</mat-label
                    >
                    <input
                      matInput
                      type="number"
                      min="15"
                      max="480"
                      [disabled]="reminderSaving()"
                      [value]="reminderIntervalDraft()"
                      (input)="
                        reminderIntervalDraft.set(asNumber($event));
                        reminderDirty.set(true)
                      "
                      (blur)="
                        reminderIntervalDraft.set(
                          clampInterval(reminderIntervalDraft())
                        )
                      "
                    />
                    <mat-hint i18n="@@reminder.interval.hint"
                      >15–480 Minuten</mat-hint
                    >
                  </mat-form-field>
                </div>

                <div>
                  <p class="field-label" i18n="@@reminder.language.label">
                    Sprache der Zitate
                  </p>
                  <mat-button-toggle-group
                    [value]="reminderLanguageDraft()"
                    [disabled]="reminderSaving()"
                    (change)="
                      reminderLanguageDraft.set($event.value);
                      reminderDirty.set(true)
                    "
                    aria-label="Erinnerungssprache"
                    i18n-aria-label="@@reminder.language.aria"
                  >
                    <mat-button-toggle value="de" i18n="@@reminder.language.de"
                      >DE</mat-button-toggle
                    >
                    <mat-button-toggle value="en" i18n="@@reminder.language.en"
                      >EN</mat-button-toggle
                    >
                  </mat-button-toggle-group>
                </div>

                <div class="quiet-hours-section">
                  <p class="field-label" i18n="@@reminder.quietHours.label">
                    Ruhezeiten
                  </p>
                  @for (qh of reminderQuietHoursDraft(); track $index) {
                    <div class="quiet-hour-row">
                      <mat-form-field appearance="outline" class="time-field">
                        <mat-label i18n="@@reminder.quietHours.from"
                          >Von</mat-label
                        >
                        <input
                          matInput
                          type="time"
                          [disabled]="reminderSaving()"
                          [value]="qh.from"
                          (change)="
                            updateQuietHour($index, 'from', asValue($event))
                          "
                        />
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="time-field">
                        <mat-label i18n="@@reminder.quietHours.to"
                          >Bis</mat-label
                        >
                        <input
                          matInput
                          type="time"
                          [disabled]="reminderSaving()"
                          [value]="qh.to"
                          (change)="
                            updateQuietHour($index, 'to', asValue($event))
                          "
                        />
                      </mat-form-field>
                      <button
                        type="button"
                        mat-icon-button
                        [disabled]="reminderSaving()"
                        (click)="removeQuietHour($index)"
                        aria-label="Ruhezeit entfernen"
                        i18n-aria-label="@@reminder.quietHours.remove.aria"
                      >
                        <mat-icon>remove_circle_outline</mat-icon>
                      </button>
                    </div>
                  }
                  <button
                    type="button"
                    mat-stroked-button
                    [disabled]="reminderSaving()"
                    (click)="addQuietHour()"
                    i18n="@@reminder.quietHours.add"
                  >
                    <mat-icon>add</mat-icon>
                    Ruhezeit hinzufügen
                  </button>
                </div>
              </div>
            }

            <div class="row">
              <button
                type="button"
                mat-flat-button
                [disabled]="!reminderDirty() || reminderSaving()"
                (click)="saveReminderSettings()"
                i18n="@@reminder.save"
              >
                <mat-icon>save</mat-icon>
                Erinnerungen speichern
              </button>
              @if (reminderSaved()) {
                <span class="muted" i18n="@@reminder.saved">Gespeichert.</span>
              }
            </div>
          </section>

          <!-- Web Push Subscription Panel -->
          <section id="reminders" class="reminder-section">
            <h3 i18n="@@push.section.title">🔔 Erinnerungen</h3>
            <p class="muted" i18n="@@push.section.desc">
              Wir tippen dir auf die Schulter, wenn es Zeit für Liegestütze ist.
            </p>

            @if (pushService.status() === 'unsupported') {
              <p class="permission-hint" i18n="@@push.status.unsupported">
                <mat-icon>info</mat-icon>
                Dein Browser unterstützt keine Push-Benachrichtigungen.
              </p>
            } @else if (pushService.status() === 'denied') {
              <p class="permission-hint" i18n="@@push.status.denied">
                <mat-icon>warning</mat-icon>
                Push-Benachrichtigungen sind blockiert. Bitte in den
                Browser-Einstellungen erlauben.
              </p>
            } @else if (pushService.status() === 'subscribed') {
              <div class="row">
                <span class="permission-ok">
                  <mat-icon>notifications_active</mat-icon>
                  <span i18n="@@push.status.subscribed"
                    >Erinnerungen aktiv ✓</span
                  >
                </span>
                <button
                  type="button"
                  mat-stroked-button
                  (click)="onPushUnsubscribe()"
                  [disabled]="pushService.status() === 'loading'"
                  i18n="@@push.unsubscribe"
                >
                  <mat-icon>notifications_off</mat-icon>
                  Deaktivieren
                </button>
              </div>
              @if (pushService.deviceCount() > 1) {
                <p class="device-count-hint muted">
                  <mat-icon>devices</mat-icon>
                  <span i18n="@@push.device.count">
                    Aktiv auf {{ pushService.deviceCount() }} Geräten
                  </span>
                </p>
              }
            } @else {
              <p class="muted" i18n="@@push.cta.desc">
                Nie wieder eine Einheit verpassen.
              </p>
              <button
                type="button"
                mat-flat-button
                color="primary"
                (click)="onPushSubscribe()"
                [disabled]="pushService.status() === 'loading'"
                i18n="@@push.subscribe"
              >
                <mat-icon>notifications</mat-icon>
                Push aktivieren
              </button>
            }
          </section>
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
    .row {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .muted {
      opacity: 0.8;
      font-size: 0.9rem;
      margin: 0;
    }
    .reminder-section {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      display: grid;
      gap: 14px;

      h3 {
        margin: 0;
      }
    }
    .reminder-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .reminder-grid {
      display: grid;
      gap: 18px;
    }
    .field-label {
      margin: 0 0 6px;
      font-size: 0.85rem;
      opacity: 0.75;
    }
    .interval-custom {
      margin-top: 8px;
      max-width: 180px;
    }
    .quiet-hours-section {
      display: grid;
      gap: 8px;
    }
    .quiet-hour-row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .time-field {
      max-width: 130px;
    }
    .permission-hint {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      color: #ffb2b2;
    }
    .permission-ok {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85rem;
      color: #90ee90;
    }
    .device-count-hint {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `,
})
export class RemindersPageComponent {
  private readonly user = inject(UserContextService);
  private readonly snackBar = inject(MatSnackBar);
  readonly reminderStore = inject(ReminderStore);
  private readonly reminderPermission = inject(ReminderPermissionService);
  private readonly reminderService = inject(ReminderService);
  readonly pushService = inject(PushSubscriptionService);

  readonly activeUserId = this.user.userIdSafe;

  // ── Reminder draft signals ────────────────────────────────────────────────
  readonly reminderEnabledDraft = signal(false);
  readonly reminderIntervalDraft = signal(60);
  readonly reminderLanguageDraft = signal<'de' | 'en'>('de');
  readonly reminderQuietHoursDraft = signal<{ from: string; to: string }[]>([]);
  readonly reminderSaving = signal(false);
  readonly reminderSaved = signal(false);
  readonly reminderDirty = signal(false);

  constructor() {
    // Init push subscription status (browser-only)
    void this.pushService.init();

    // Sync reminder draft from store
    effect(() => {
      const rc = this.reminderStore.config();
      this.reminderEnabledDraft.set(rc?.enabled ?? false);
      this.reminderIntervalDraft.set(rc?.intervalMinutes ?? 60);
      this.reminderLanguageDraft.set(rc?.language ?? 'de');
      this.reminderQuietHoursDraft.set(
        rc?.quietHours ? [...rc.quietHours] : []
      );
      this.reminderDirty.set(false);
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
    this.reminderEnabledDraft.set(enabled);
    this.reminderDirty.set(true);
  }

  addQuietHour(): void {
    this.reminderQuietHoursDraft.update((qhs) => [
      ...qhs,
      { from: '22:00', to: '07:00' },
    ]);
    this.reminderDirty.set(true);
  }

  removeQuietHour(index: number): void {
    this.reminderQuietHoursDraft.update((qhs) =>
      qhs.filter((_, i) => i !== index)
    );
    this.reminderDirty.set(true);
  }

  updateQuietHour(index: number, field: 'from' | 'to', value: string): void {
    this.reminderQuietHoursDraft.update((qhs) => {
      const copy = [...qhs];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
    this.reminderDirty.set(true);
  }

  clampInterval(value: number): number {
    if (Number.isNaN(value)) return 60;
    return Math.min(480, Math.max(15, value));
  }

  async saveReminderSettings(): Promise<void> {
    const userId = this.activeUserId();
    const intervalMinutes = this.clampInterval(this.reminderIntervalDraft());
    this.reminderIntervalDraft.set(intervalMinutes);
    if (!userId) {
      this.snackBar.open(
        $localize`:@@reminder.save.error:Einstellungen konnten nicht gespeichert werden.`,
        $localize`:@@snackbar.close:Schließen`,
        { duration: 5000 }
      );
      return;
    }
    const config: ReminderConfig = {
      enabled: this.reminderEnabledDraft(),
      intervalMinutes,
      quietHours: this.reminderQuietHoursDraft(),
      timezone:
        this.reminderStore.config()?.timezone ||
        Intl.DateTimeFormat().resolvedOptions().timeZone ||
        'Europe/Berlin',
      language: this.reminderLanguageDraft(),
    };
    this.reminderSaving.set(true);
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
        this.reminderService.start();
      } else {
        this.reminderService.stop();
      }
      this.reminderSaved.set(true);
      this.reminderDirty.set(false);
      setTimeout(() => this.reminderSaved.set(false), 1500);
    } finally {
      this.reminderSaving.set(false);
    }
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  asNumber(event: Event): number {
    const raw = (event.target as HTMLInputElement).value;
    const n = Number(raw);
    return Number.isNaN(n) ? 100 : n;
  }
}
