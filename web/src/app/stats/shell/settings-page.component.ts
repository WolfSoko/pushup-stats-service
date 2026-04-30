import {
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { RouterLink } from '@angular/router';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { Router } from '@angular/router';
import { Analytics, logEvent } from '@angular/fire/analytics';
import { PushSubscriptionService } from '@pu-reminders/reminders';
import { DEFAULT_SNAP_QUALITY, SnapQuality } from '@pu-stats/models';
import { UserConfigStore } from '../../core/user-config.store';
import { ShareService } from '../../core/share.service';

@Component({
  selector: 'app-settings-page',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSnackBarModule,
    MatDialogModule,
    MatButtonToggleModule,
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
                >Du nutzt die App als Gast. Erstelle ein Konto um alle
                Funktionen zu nutzen.</span
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
              [checked]="publicProfileDraft()"
              (change)="publicProfileDraft.set($event.checked)"
              data-testid="settings-public-profile-toggle"
              i18n="@@settings.publicProfile.toggle"
            >
              Öffentliches Profil aktivieren
            </mat-slide-toggle>

            <p class="muted" i18n="@@settings.publicProfile.hint">
              Erlaubt jedem mit dem Link den Zugriff auf deine Reps, Streak und
              Bestleistungen. Dein Anzeigename ist sichtbar; E-Mail, Ziele und
              Erinnerungen bleiben privat.
            </p>

            @if (publicProfileDraft() && profileUrl()) {
              <div
                class="profile-link-row"
                data-testid="settings-public-profile-link"
              >
                <code class="profile-link">{{ profileUrl() }}</code>
                <button
                  type="button"
                  mat-stroked-button
                  (click)="shareMyProfile()"
                  i18n="@@settings.publicProfile.shareCta"
                >
                  <mat-icon>share</mat-icon>
                  Profil teilen
                </button>
              </div>
            }

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

            <mat-form-field appearance="outline">
              <mat-label i18n="@@dailyGoalLabel">Tagesziel (Reps)</mat-label>
              <input
                matInput
                type="number"
                min="1"
                [value]="dailyGoalDraft()"
                (input)="
                  dailyGoalDraft.set(asNumberOr($event, dailyGoalDraft()))
                "
                placeholder="10"
                i18n-placeholder="@@dailyGoalPlaceholder"
              />
              <mat-hint i18n="@@settings.goalHint"
                >Wird prominent in der Toolbar angezeigt.</mat-hint
              >
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label i18n="@@weeklyGoalLabel">Wochenziel (Reps)</mat-label>
              <input
                matInput
                type="number"
                min="1"
                [value]="weeklyGoalDraft()"
                (input)="
                  weeklyGoalDraft.set(asNumberOr($event, weeklyGoalDraft()))
                "
                placeholder="50"
                i18n-placeholder="@@weeklyGoalPlaceholder"
              />
              <mat-hint i18n="@@settings.weeklyGoalHint"
                >Gesamtziel pro Woche (Mo–So).</mat-hint
              >
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label i18n="@@monthlyGoalLabel">Monatsziel (Reps)</mat-label>
              <input
                matInput
                type="number"
                min="1"
                [value]="monthlyGoalDraft()"
                (input)="
                  monthlyGoalDraft.set(asNumberOr($event, monthlyGoalDraft()))
                "
                placeholder="200"
                i18n-placeholder="@@monthlyGoalPlaceholder"
              />
              <mat-hint i18n="@@settings.monthlyGoalHint"
                >Gesamtziel pro Monat.</mat-hint
              >
            </mat-form-field>

            <div class="snap-quality-field">
              <span
                id="snap-quality-label"
                class="snap-quality-label"
                i18n="@@settings.snapQualityLabel"
                >Snap-Animation Qualität</span
              >
              <mat-button-toggle-group
                hideSingleSelectionIndicator
                [value]="snapQualityDraft()"
                (change)="snapQualityDraft.set($event.value)"
                aria-labelledby="snap-quality-label"
                data-testid="settings-snap-quality"
              >
                <mat-button-toggle value="low" i18n="@@settings.snapQuality.low"
                  >Niedrig</mat-button-toggle
                >
                <mat-button-toggle
                  value="middle"
                  i18n="@@settings.snapQuality.middle"
                  >Mittel</mat-button-toggle
                >
                <mat-button-toggle
                  value="high"
                  i18n="@@settings.snapQuality.high"
                  >Hoch</mat-button-toggle
                >
              </mat-button-toggle-group>
              <p class="muted" i18n="@@settings.snapQualityHint">
                Steuert die Partikelanzahl der „Ziel erreicht“-Animation (40k /
                120k / 200k).
              </p>
            </div>
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

          <section class="reminders-link-section">
            <h3 i18n="@@settings.remindersLinkTitle">🔔 Erinnerungen</h3>
            <p class="muted" i18n="@@settings.remindersLinkDesc">
              Liegestütz-Erinnerungen und Push-Benachrichtigungen konfigurieren.
            </p>
            <a
              mat-stroked-button
              routerLink="/reminders"
              i18n="@@settings.remindersLinkCta"
            >
              <mat-icon>notifications</mat-icon>
              Erinnerungen verwalten
            </a>
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
    .muted {
      opacity: 0.8;
      font-size: 0.9rem;
      margin: 0;
    }
    .profile-link-row {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      padding: 10px 12px;
      border-radius: 10px;
      background: rgba(123, 159, 255, 0.12);
      border: 1px solid rgba(123, 159, 255, 0.28);
    }
    .profile-link {
      flex: 1 1 auto;
      min-width: 0;
      font-family: ui-monospace, monospace;
      font-size: 0.85rem;
      overflow-wrap: anywhere;
    }
    .reminders-link-section {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      display: grid;
      gap: 10px;

      h3 {
        margin: 0;
      }
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
    .snap-quality-field {
      display: grid;
      gap: 6px;
      align-content: start;
    }
    .snap-quality-label {
      font-size: 0.85rem;
      opacity: 0.85;
    }
  `,
})
export class SettingsPageComponent {
  private readonly user = inject(UserContextService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly snackBar = inject(MatSnackBar);
  private readonly pushService = inject(PushSubscriptionService);
  private readonly userConfigStore = inject(UserConfigStore);
  private readonly shareService = inject(ShareService);

  readonly isGuest = this.user.isGuest;
  readonly userId = this.user.userIdSafe;

  readonly displayNameDraft = signal('');
  readonly dailyGoalDraft = signal<number>(10);
  readonly weeklyGoalDraft = signal<number>(50);
  readonly monthlyGoalDraft = signal<number>(200);
  readonly leaderboardOptOutDraft = signal(false);
  readonly publicProfileDraft = signal(false);
  readonly adsConsentDraft = signal(false);
  readonly snapQualityDraft = signal<SnapQuality>(DEFAULT_SNAP_QUALITY);

  readonly profileUrl = computed(() => {
    const uid = this.userId();
    return uid ? `https://pushup-stats.de/u/${uid}` : '';
  });

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly deletingAccount = signal(false);
  readonly errorMessage = signal('');
  readonly deletePhraseInput = signal('');
  readonly deleteDialogError = signal('');

  readonly config = computed(() => {
    const val = this.userConfigStore.config();
    if (!val || typeof val !== 'object')
      return {
        displayName: '',
        dailyGoal: 10,
        weeklyGoal: 50,
        monthlyGoal: 200,
        hideFromLeaderboard: false,
        publicProfile: false,
        consent: { targetedAds: true },
        snapQuality: DEFAULT_SNAP_QUALITY,
      };
    return {
      displayName: (val as { displayName?: string }).displayName ?? '',
      dailyGoal: Math.max(
        1,
        Math.trunc((val as { dailyGoal?: number }).dailyGoal || 10)
      ),
      weeklyGoal: Math.max(
        1,
        Math.trunc((val as { weeklyGoal?: number }).weeklyGoal || 50)
      ),
      monthlyGoal: Math.max(
        1,
        Math.trunc((val as { monthlyGoal?: number }).monthlyGoal || 200)
      ),
      hideFromLeaderboard:
        (val as { ui?: { hideFromLeaderboard?: boolean } }).ui
          ?.hideFromLeaderboard ?? false,
      publicProfile:
        (val as { ui?: { publicProfile?: boolean } }).ui?.publicProfile ??
        false,
      consent: (val as { consent?: { targetedAds?: boolean } }).consent ?? {
        targetedAds: true,
      },
      snapQuality:
        (val as { ui?: { snapQuality?: SnapQuality } }).ui?.snapQuality ??
        DEFAULT_SNAP_QUALITY,
    };
  });

  constructor() {
    effect(() => {
      const cfg = this.config();
      if (!cfg) return;
      this.displayNameDraft.set(cfg.displayName);
      this.dailyGoalDraft.set(cfg.dailyGoal);
      this.weeklyGoalDraft.set(cfg.weeklyGoal);
      this.monthlyGoalDraft.set(cfg.monthlyGoal);
      this.leaderboardOptOutDraft.set(cfg.hideFromLeaderboard);
      this.publicProfileDraft.set(cfg.publicProfile);
      this.adsConsentDraft.set(cfg.consent?.targetedAds ?? true);
      this.snapQualityDraft.set(cfg.snapQuality);
    });
  }

  shareMyProfile(): void {
    const url = this.profileUrl();
    if (!url) return;
    void this.shareService.share({
      title: $localize`:@@settings.publicProfile.share.title:Mein Pushup Tracker Profil`,
      text: $localize`:@@settings.publicProfile.share.text:Schau dir mein Pushup-Profil an:`,
      url,
    });
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  asNumberOr(event: Event, fallback: number): number {
    const raw = (event.target as HTMLInputElement).value;
    if (raw === '') return fallback;
    const n = Number(raw);
    return Number.isNaN(n) ? fallback : n;
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.saved.set(false);
    this.errorMessage.set('');
    const dailyGoal = Math.max(1, Math.trunc(this.dailyGoalDraft()));
    const weeklyGoal = Math.max(1, Math.trunc(this.weeklyGoalDraft()));
    const monthlyGoal = Math.max(1, Math.trunc(this.monthlyGoalDraft()));
    try {
      const current = this.config();
      await this.userConfigStore.save({
        displayName: this.displayNameDraft().trim(),
        dailyGoal,
        weeklyGoal,
        monthlyGoal,
        consent: {
          ...(current.consent ?? {}),
          targetedAds: this.adsConsentDraft(),
        },
        ui: {
          hideFromLeaderboard: this.leaderboardOptOutDraft(),
          publicProfile: this.publicProfileDraft(),
          snapQuality: this.snapQualityDraft(),
        },
      });
      this.saved.set(true);
      this.trackAnalytics('settings_saved', {
        hideFromLeaderboard: this.leaderboardOptOutDraft(),
        publicProfile: this.publicProfileDraft(),
        dailyGoal,
        weeklyGoal,
        monthlyGoal,
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

    try {
      await this.userConfigStore.save({
        displayName: 'Gelöschter Benutzer',
        email: null,
        ui: {
          hideFromLeaderboard: true,
        },
      });
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
