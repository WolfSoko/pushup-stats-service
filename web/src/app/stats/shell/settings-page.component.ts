import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  resource,
  signal,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserConfigApiService } from '@pu-stats/data-access';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { Router } from '@angular/router';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { ReminderStore } from '../../core/reminder/reminder.store';
import { ReminderPermissionService } from '../../core/reminder/reminder-permission.service';
import { ReminderService } from '../../core/reminder/reminder.service';
import { PushSubscriptionService } from '../../core/push/push-subscription.service';
import type { ReminderConfig } from '@pu-stats/models';

@Component({
  selector: 'app-settings-page',
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
    MatDialogModule,
    RouterLink,
  ],
  template: `
    <main class="page-wrap">
      <mat-card>
        <mat-card-header>
          <mat-card-title i18n="@@settingsTitle">Einstellungen</mat-card-title>
          <mat-card-subtitle i18n="@@settingsSubtitle"
            >User-Profil & Tagesziel</mat-card-subtitle
          >
        </mat-card-header>

        <mat-card-content>
          @if (isGuest()) {
            <div class="guest-banner">
              <mat-icon>info</mat-icon>
              <span i18n="@@guest.banner.text"
                >Du nutzt PUS als Gast. Erstelle ein Konto um alle Funktionen zu
                nutzen.</span
              >
              <a
                mat-stroked-button
                routerLink="/register"
                i18n="@@guest.banner.cta"
                >Konto erstellen</a
              >
            </div>
          }
          <section class="grid">
            <mat-form-field appearance="outline">
              <mat-label i18n="@@displayNameLabel">Anzeigename</mat-label>
              <input
                matInput
                [value]="displayNameDraft()"
                (input)="displayNameDraft.set(asValue($event))"
                placeholder="Wolf"
                i18n-placeholder="@@displayNamePlaceholder"
              />
              <mat-hint i18n="@@settings.displayNameHint"
                >Kann in der Bestenliste angezeigt werden.</mat-hint
              >
            </mat-form-field>

            <mat-slide-toggle
              [checked]="!leaderboardOptOutDraft()"
              (change)="leaderboardOptOutDraft.set(!$event.checked)"
              i18n="@@settings.leaderboardOptIn"
            >
              In Bestenliste anzeigen
            </mat-slide-toggle>

            <p class="muted" i18n="@@settings.leaderboardOptOutHint">
              Wenn deaktiviert, wird dein Profil in der Bestenliste nicht
              angezeigt.
            </p>

            <mat-slide-toggle
              [checked]="adsConsentDraft()"
              (change)="adsConsentDraft.set($event.checked)"
              i18n="@@settings.adsConsentOptIn"
            >
              Personalisierte Werbung aktivieren
            </mat-slide-toggle>

            <p class="muted" i18n="@@settings.adsConsentHint">
              Steuert, ob Werbe-Slots im Dashboard geladen werden dürfen.
            </p>

            <mat-form-field appearance="outline" class="goal-field">
              <mat-label i18n="@@dailyGoalLabel">Tagesziel (Reps)</mat-label>
              <input
                matInput
                type="number"
                min="1"
                [value]="dailyGoalDraft()"
                (input)="dailyGoalDraft.set(asNumber($event))"
                placeholder="100"
                i18n-placeholder="@@dailyGoalPlaceholder"
              />
              <mat-hint i18n="@@settings.goalHint"
                >Wird prominent in der Toolbar angezeigt.</mat-hint
              >
            </mat-form-field>
          </section>

          @if (errorMessage()) {
            <p class="error" role="alert">{{ errorMessage() }}</p>
          }

          <div class="row">
            <button
              type="button"
              mat-flat-button
              [disabled]="saving()"
              (click)="save()"
              i18n="@@saveSettings"
            >
              <mat-icon>save</mat-icon>
              Speichern
            </button>
            @if (saving()) {
              <span class="muted" i18n="@@saving">Speichert…</span>
            }
            @if (saved()) {
              <span class="muted" i18n="@@saved">Gespeichert.</span>
            }
          </div>

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
                          [value]="qh.to"
                          (change)="
                            updateQuietHour($index, 'to', asValue($event))
                          "
                        />
                      </mat-form-field>
                      <button
                        type="button"
                        mat-icon-button
                        (click)="removeQuietHour($index)"
                        aria-label="Remove quiet hour"
                        i18n-aria-label="@@reminder.quietHours.remove.aria"
                      >
                        <mat-icon>remove_circle_outline</mat-icon>
                      </button>
                    </div>
                  }
                  <button
                    type="button"
                    mat-stroked-button
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
          <section class="reminder-section">
            <h3 i18n="@@push.section.title">📱 Browser-Push-Benachrichtigungen</h3>
            <p class="muted" i18n="@@push.section.desc">
              Empfange Erinnerungen auch wenn PUS im Hintergrund läuft
              (solange der Browser geöffnet ist).
            </p>

            @if (pushService.status() === 'unsupported') {
              <p class="permission-hint" i18n="@@push.status.unsupported">
                <mat-icon>info</mat-icon>
                Dein Browser unterstützt keine Push-Benachrichtigungen.
              </p>
            } @else if (pushService.status() === 'denied') {
              <p class="permission-hint" i18n="@@push.status.denied">
                <mat-icon>warning</mat-icon>
                Push-Benachrichtigungen sind im Browser blockiert.
                Bitte in den Browser-Einstellungen erlauben.
              </p>
            } @else if (pushService.status() === 'subscribed') {
              <div class="row">
                <span class="permission-ok">
                  <mat-icon>notifications_active</mat-icon>
                  <span i18n="@@push.status.subscribed">Push aktiv</span>
                </span>
                <button
                  type="button"
                  mat-stroked-button
                  (click)="onPushUnsubscribe()"
                  [disabled]="pushService.status() === 'loading'"
                  i18n="@@push.unsubscribe"
                >
                  <mat-icon>notifications_off</mat-icon>
                  Push deaktivieren
                </button>
              </div>
            } @else {
              <button
                type="button"
                mat-flat-button
                (click)="onPushSubscribe()"
                [disabled]="pushService.status() === 'loading'"
                i18n="@@push.subscribe"
              >
                <mat-icon>notifications</mat-icon>
                Push aktivieren
              </button>
            }
          </section>

          <section class="danger-zone">
            <h3 i18n="@@settings.dangerZoneTitle">Danger Zone</h3>
            <p i18n="@@settings.dangerZoneBody">
              Konto löschen entfernt dein Konto. Trainingsdaten bleiben für
              statistische Auswertung anonymisiert erhalten.
            </p>
            <button
              type="button"
              mat-stroked-button
              color="warn"
              [disabled]="deletingAccount()"
              (click)="openDeleteDialog(deleteDialogTpl)"
              i18n="@@settings.deleteAccount"
            >
              <mat-icon>warning</mat-icon>
              Konto löschen
            </button>
            @if (deletingAccount()) {
              <span class="muted" i18n="@@settings.deletingAccount"
                >Konto wird gelöscht…</span
              >
            }
          </section>

          <ng-template #deleteDialogTpl>
            <h2 mat-dialog-title i18n="@@settings.deleteDialogTitle">
              Account wirklich löschen?
            </h2>
            <mat-dialog-content class="delete-dialog-content">
              <p i18n="@@settings.deleteDialogWarning">
                Achtung: Diese Aktion ist nicht rückgängig.
              </p>
              <p i18n="@@settings.deleteDialogInfo">
                Dein Konto wird gelöscht. Trainingsdaten bleiben für
                statistische Auswertung anonymisiert erhalten.
              </p>
              <mat-form-field appearance="outline">
                <mat-label i18n="@@settings.deleteDialogPhraseLabel"
                  >Bestätigungswort eingeben</mat-label
                >
                <input
                  matInput
                  [value]="deletePhraseInput()"
                  (input)="deletePhraseInput.set(asValue($event))"
                  placeholder="löscchen"
                />
                <mat-hint i18n="@@settings.deleteDialogPhraseHint"
                  >Bitte exakt „löscchen“ eingeben.</mat-hint
                >
              </mat-form-field>
              @if (deleteDialogError()) {
                <p class="error" role="alert">{{ deleteDialogError() }}</p>
              }
            </mat-dialog-content>
            <mat-dialog-actions align="end">
              <button mat-button mat-dialog-close i18n="@@cancel">
                Abbrechen
              </button>
              <button
                mat-flat-button
                color="warn"
                (click)="confirmDeleteFromDialog()"
                i18n="@@settings.deleteConfirmFinal"
              >
                Final löschen
              </button>
            </mat-dialog-actions>
          </ng-template>
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
    .grid {
      display: grid;
      gap: 18px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      align-items: start;
    }
    .row {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .goal-field {
      grid-column: 1 / -1;
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
    .danger-zone {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px dashed rgba(255, 120, 120, 0.45);
      display: grid;
      gap: 8px;

      h3 {
        margin: 0;
        color: #ffb2b2;
      }

      p {
        margin: 0;
      }
    }
    .delete-dialog-content {
      display: grid;
      gap: 10px;
      min-width: min(92vw, 460px);

      p {
        margin: 0;
      }
    }
    .error {
      color: #ffd8d8;
    }
    .guest-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      margin-bottom: 16px;
      border-radius: 6px;
      background: rgba(100, 160, 255, 0.1);
      border: 1px solid rgba(100, 160, 255, 0.3);
      flex-wrap: wrap;
    }
  `,
})
export class SettingsPageComponent {
  private readonly api = inject(UserConfigApiService);
  private readonly user = inject(UserContextService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly snackBar = inject(MatSnackBar);
  readonly reminderStore = inject(ReminderStore);
  private readonly reminderPermission = inject(ReminderPermissionService);
  private readonly reminderService = inject(ReminderService);
  readonly pushService = inject(PushSubscriptionService);

  readonly activeUserId = this.user.userIdSafe;
  readonly isGuest = this.user.isGuest;

  readonly displayNameDraft = signal('');
  readonly dailyGoalDraft = signal<number>(100);
  readonly leaderboardOptOutDraft = signal(false);
  readonly adsConsentDraft = signal(false);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly deletingAccount = signal(false);
  readonly errorMessage = signal('');
  readonly deletePhraseInput = signal('');
  readonly deleteDialogError = signal('');

  // ── Reminder draft signals ────────────────────────────────────────────────
  readonly reminderEnabledDraft = signal(false);
  readonly reminderIntervalDraft = signal(60);
  readonly reminderLanguageDraft = signal<'de' | 'en'>('de');
  readonly reminderQuietHoursDraft = signal<{ from: string; to: string }[]>([]);
  readonly reminderSaving = signal(false);
  readonly reminderSaved = signal(false);
  readonly reminderDirty = signal(false);

  readonly configResource = resource({
    params: () => ({ userId: this.activeUserId() }),
    loader: async ({ params }) => {
      const result = await firstValueFrom(this.api.getConfig(params.userId));
      return (result ?? {}) as {
        displayName?: string;
        dailyGoal?: number;
        consent?: {
          dataProcessing?: boolean;
          statistics?: boolean;
          targetedAds?: boolean;
          acceptedAt?: string;
        };
        ui?: { hideFromLeaderboard?: boolean };
      };
    },
  });

  readonly config = computed(() => {
    const val = this.configResource.value();
    if (!val || typeof val !== 'object')
      return {
        displayName: '',
        dailyGoal: 100,
        hideFromLeaderboard: false,
        consent: { targetedAds: true },
      };
    return {
      displayName: (val as { displayName?: string }).displayName ?? '',
      dailyGoal: (val as { dailyGoal?: number }).dailyGoal ?? 100,
      hideFromLeaderboard:
        (val as { ui?: { hideFromLeaderboard?: boolean } }).ui
          ?.hideFromLeaderboard ?? false,
      consent: (val as { consent?: { targetedAds?: boolean } }).consent ?? {
        targetedAds: true,
      },
    };
  });

  constructor() {
    // Init push subscription status (browser-only)
    void this.pushService.init();

    effect(() => {
      const cfg = this.config();
      if (!cfg) return;
      this.displayNameDraft.set(cfg.displayName ?? '');
      this.dailyGoalDraft.set(cfg.dailyGoal ?? 100);
      this.leaderboardOptOutDraft.set(cfg.hideFromLeaderboard ?? false);
      this.adsConsentDraft.set(cfg.consent?.targetedAds ?? true);
    });

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

  // ── Reminder methods ─────────────────────────────────────────────────────

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

  async onReminderToggle(enabled: boolean): Promise<void> {
    if (enabled && this.reminderPermission.status() !== 'granted') {
      const result = await this.reminderPermission.requestPermission();
      if (result !== 'granted') {
        this.snackBar.open(
          $localize`:@@reminder.permission.snackbar:Benachrichtigungen sind blockiert. Bitte in den Browser-Einstellungen erlauben.`,
          $localize`:@@snackbar.close:Schließen`,
          { duration: 5000 }
        );
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
    const config: ReminderConfig = {
      enabled: this.reminderEnabledDraft(),
      intervalMinutes: this.reminderIntervalDraft(),
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
      if (!this.reminderStore.error()) {
        if (config.enabled) {
          this.reminderService.start();
        } else {
          this.reminderService.stop();
        }
        this.reminderSaved.set(true);
        this.reminderDirty.set(false);
        setTimeout(() => this.reminderSaved.set(false), 1500);
      }
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

  async save(): Promise<void> {
    this.saving.set(true);
    this.saved.set(false);
    this.errorMessage.set('');
    const userId = this.activeUserId();
    const dailyGoal = Math.max(1, this.dailyGoalDraft());
    try {
      const current = this.config();
      await firstValueFrom(
        this.api.updateConfig(userId, {
          displayName: this.displayNameDraft().trim(),
          dailyGoal,
          consent: {
            ...(current.consent ?? {}),
            targetedAds: this.adsConsentDraft(),
          },
          ui: {
            hideFromLeaderboard: this.leaderboardOptOutDraft(),
          },
        })
      );
      this.saved.set(true);
      this.configResource.reload();
      this.trackAnalytics('settings_saved', {
        hideFromLeaderboard: this.leaderboardOptOutDraft(),
        dailyGoal,
        adsConsent: this.adsConsentDraft(),
      });
    } catch {
      this.errorMessage.set('Konnte nicht speichern.');
    } finally {
      this.saving.set(false);
      setTimeout(() => this.saved.set(false), 1500);
    }
  }

  openDeleteDialog(dialogTemplate: TemplateRef<unknown>): void {
    this.deletePhraseInput.set('');
    this.deleteDialogError.set('');
    this.dialog.open(dialogTemplate, {
      width: '520px',
      disableClose: true,
    });
  }

  async confirmDeleteFromDialog(): Promise<void> {
    if (this.deletePhraseInput().trim().toLowerCase() !== 'löscchen') {
      this.deleteDialogError.set('Bitte exakt „löscchen“ eingeben.');
      return;
    }

    this.dialog.closeAll();

    this.deletingAccount.set(true);
    this.errorMessage.set('');

    const userId = this.activeUserId();
    try {
      await firstValueFrom(
        this.api.updateConfig(userId, {
          displayName: 'Gelöschter Benutzer',
          email: null,
          ui: {
            hideFromLeaderboard: true,
          },
        })
      );
      await this.pushService.unsubscribe();
      await this.auth.deleteAccount();
      this.trackAnalytics('account_anonymized_and_deleted', { success: true });
      await this.router.navigateByUrl('/');
    } catch {
      this.errorMessage.set('Konnte Konto nicht löschen.');
    } finally {
      this.deletingAccount.set(false);
    }
  }

  private trackAnalytics(
    eventName: string,
    params: Record<string, string | number | boolean>
  ): void {
    if (!this.analytics || !this.analyticsConsentGranted()) return;
    logEvent(this.analytics, eventName, params);
  }

  private analyticsConsentGranted(): boolean {
    const storage = globalThis.localStorage;
    const hasGetItem = typeof storage?.getItem === 'function';
    if (!hasGetItem) return false;
    return storage.getItem('pus_analytics_consent') === 'granted';
  }
}
