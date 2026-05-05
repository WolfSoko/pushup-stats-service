import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnDestroy,
  PLATFORM_ID,
  TemplateRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
import { buildProfileShareUrl } from '../../core/profile-share-url';
import { PageHeaderComponent } from '../../core/page-header/page-header.component';

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const AUTO_SAVE_DEBOUNCE_MS = 600;
const SAVED_INDICATOR_MS = 1800;

interface DraftSnapshot {
  displayName: string;
  dailyGoal: number;
  weeklyGoal: number;
  monthlyGoal: number;
  hideFromLeaderboard: boolean;
  publicProfile: boolean;
  adsConsent: boolean;
  snapQuality: SnapQuality;
}

interface ResolvedConfig {
  displayName: string;
  dailyGoal: number;
  weeklyGoal: number;
  monthlyGoal: number;
  hideFromLeaderboard: boolean;
  publicProfile: boolean;
  consent: { targetedAds?: boolean } & Record<string, unknown>;
  snapQuality: SnapQuality;
}

@Component({
  selector: 'app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatButtonToggleModule,
    PageHeaderComponent,
    RouterLink,
  ],
  template: `
    <main class="page-wrap">
      <app-page-header icon="tune" variant="settings">
        <h1 page-title i18n="@@settingsHeaderTitle">Einstellungen</h1>
        <p page-subtitle i18n="@@settingsHeaderSubtitle">
          Profil, Ziele und Sichtbarkeit nach deinem Geschmack.
        </p>
        <div
          page-actions
          class="save-status"
          role="status"
          aria-live="polite"
          [attr.data-status]="saveStatus()"
          data-testid="settings-save-status"
        >
          @switch (saveStatus()) {
            @case ('saving') {
              <mat-progress-spinner
                diameter="16"
                mode="indeterminate"
              ></mat-progress-spinner>
              <span i18n="@@settings.status.saving">Speichert…</span>
            }
            @case ('saved') {
              <mat-icon class="status-icon ok">check_circle</mat-icon>
              <span i18n="@@settings.status.saved">Gespeichert</span>
            }
            @case ('error') {
              <mat-icon class="status-icon err">error</mat-icon>
              <span i18n="@@settings.status.error">Fehler beim Speichern</span>
              <button
                type="button"
                mat-stroked-button
                (click)="retrySave()"
                i18n="@@settings.status.retry"
              >
                Erneut versuchen
              </button>
            }
            @case ('pending') {
              <mat-icon class="status-icon">edit</mat-icon>
              <span i18n="@@settings.status.pending"
                >Ungespeicherte Änderungen…</span
              >
            }
            @default {
              <mat-icon class="status-icon ok">cloud_done</mat-icon>
              <span i18n="@@settings.status.synced"
                >Alle Änderungen gespeichert</span
              >
            }
          }
        </div>
      </app-page-header>

      @if (isGuest()) {
        <div class="guest-banner">
          <mat-icon>info</mat-icon>
          <span i18n="@@guest.banner.text"
            >Du nutzt die App als Gast. Erstelle ein Konto um alle Funktionen zu
            nutzen.</span
          >
          <a mat-stroked-button routerLink="/register" i18n="@@guest.banner.cta"
            >Konto erstellen</a
          >
        </div>
      }

      <mat-card class="section-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>person</mat-icon>
          <mat-card-title i18n="@@settings.section.profile.title"
            >Profil</mat-card-title
          >
          <mat-card-subtitle i18n="@@settings.section.profile.subtitle">
            Wie du in der App und der Bestenliste erscheinst.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field appearance="outline" class="full-width">
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
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>visibility</mat-icon>
          <mat-card-title i18n="@@settings.section.privacy.title"
            >Sichtbarkeit</mat-card-title
          >
          <mat-card-subtitle i18n="@@settings.section.privacy.subtitle">
            Steuere, wer dein Profil sehen kann.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content class="stack">
          <div class="setting-row">
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
          </div>

          <div class="setting-row">
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

            <!-- Gate the share CTA on the persisted setting (not the draft).
                 If we showed the link as soon as the toggle flipped, a user
                 could tap "Profil teilen" before the auto-save round trip has
                 written ui.publicProfile to Firestore and end up sharing a
                 link that the backend will 404. -->
            @if (config().publicProfile && profileUrl()) {
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
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>flag</mat-icon>
          <mat-card-title i18n="@@settings.section.goals.title"
            >Ziele</mat-card-title
          >
          <mat-card-subtitle i18n="@@settings.section.goals.subtitle">
            Tägliche, wöchentliche und monatliche Ziele.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="grid">
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
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>tune</mat-icon>
          <mat-card-title i18n="@@settings.section.display.title"
            >Anzeige</mat-card-title
          >
          <mat-card-subtitle i18n="@@settings.section.display.subtitle">
            Animationen und Darstellung.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
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
              <mat-button-toggle value="high" i18n="@@settings.snapQuality.high"
                >Hoch</mat-button-toggle
              >
            </mat-button-toggle-group>
            <p class="muted" i18n="@@settings.snapQualityHint">
              Steuert die Partikelanzahl der „Ziel erreicht“-Animation (40k /
              120k / 200k).
            </p>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>campaign</mat-icon>
          <mat-card-title i18n="@@settings.section.ads.title"
            >Werbung</mat-card-title
          >
          <mat-card-subtitle i18n="@@settings.section.ads.subtitle">
            Personalisierung der Werbe-Slots.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-content class="stack">
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
        </mat-card-content>
      </mat-card>

      <mat-card class="section-card">
        <mat-card-header>
          <mat-icon mat-card-avatar>notifications</mat-icon>
          <mat-card-title i18n="@@settings.remindersLinkTitle"
            >Erinnerungen</mat-card-title
          >
          <mat-card-subtitle i18n="@@settings.remindersLinkDesc">
            Liegestütz-Erinnerungen und Push-Benachrichtigungen konfigurieren.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
          <a
            mat-stroked-button
            routerLink="/reminders"
            i18n="@@settings.remindersLinkCta"
          >
            <mat-icon>notifications</mat-icon>
            Erinnerungen verwalten
          </a>
        </mat-card-actions>
      </mat-card>

      <mat-card class="section-card danger-zone">
        <mat-card-header>
          <mat-icon mat-card-avatar class="danger-icon">warning</mat-icon>
          <mat-card-title i18n="@@settings.dangerZoneTitle"
            >Danger Zone</mat-card-title
          >
          <mat-card-subtitle i18n="@@settings.dangerZoneBody">
            Konto löschen entfernt dein Konto. Trainingsdaten bleiben für
            statistische Auswertung anonymisiert erhalten.
          </mat-card-subtitle>
        </mat-card-header>
        <mat-card-actions>
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
        </mat-card-actions>
      </mat-card>

      <ng-template #deleteDialogTpl>
        <h2 mat-dialog-title i18n="@@settings.deleteDialogTitle">
          Account wirklich löschen?
        </h2>
        <mat-dialog-content class="delete-dialog-content">
          <p i18n="@@settings.deleteDialogWarning">
            Achtung: Diese Aktion ist nicht rückgängig.
          </p>
          <p i18n="@@settings.deleteDialogInfo">
            Dein Konto wird gelöscht. Trainingsdaten bleiben für statistische
            Auswertung anonymisiert erhalten.
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
          <button mat-button mat-dialog-close i18n="@@cancel">Abbrechen</button>
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
    </main>
  `,
  styles: `
    .page-wrap {
      max-width: 900px;
      margin: 0 auto;
      padding: 16px;
      display: grid;
      gap: 16px;
    }
    .save-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.85rem;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      transition:
        background 200ms ease,
        border-color 200ms ease;
    }
    .save-status[data-status='saving'] {
      background: rgba(123, 159, 255, 0.16);
      border-color: rgba(123, 159, 255, 0.4);
    }
    .save-status[data-status='saved'] {
      background: rgba(120, 220, 140, 0.14);
      border-color: rgba(120, 220, 140, 0.36);
    }
    .save-status[data-status='error'] {
      background: rgba(255, 120, 120, 0.16);
      border-color: rgba(255, 120, 120, 0.45);
    }
    .save-status[data-status='pending'] {
      background: rgba(255, 200, 100, 0.14);
      border-color: rgba(255, 200, 100, 0.36);
    }
    .save-status .status-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .save-status .status-icon.ok {
      color: #7fd99a;
    }
    .save-status .status-icon.err {
      color: #ff8b8b;
    }
    .section-card {
      padding: 4px 4px 8px;
    }
    .section-card mat-card-header {
      padding-bottom: 8px;
    }
    .section-card[class*='danger-zone'] {
      border: 1px dashed rgba(255, 120, 120, 0.45);
    }
    .danger-icon {
      color: #ffb2b2;
    }
    .grid {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      align-items: start;
    }
    .stack {
      display: grid;
      gap: 12px;
    }
    .setting-row {
      display: grid;
      gap: 6px;
    }
    .full-width {
      width: 100%;
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
      border-radius: 6px;
      background: rgba(100, 160, 255, 0.1);
      border: 1px solid rgba(100, 160, 255, 0.3);
      flex-wrap: wrap;
    }
    .snap-quality-field {
      display: grid;
      gap: 8px;
      align-content: start;
    }
    .snap-quality-label {
      font-size: 0.85rem;
      opacity: 0.85;
    }
  `,
})
export class SettingsPageComponent implements OnDestroy {
  private readonly user = inject(UserContextService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly analytics = inject(Analytics, { optional: true });
  private readonly pushService = inject(PushSubscriptionService);
  private readonly userConfigStore = inject(UserConfigStore);
  private readonly shareService = inject(ShareService);
  private readonly localeId = inject(LOCALE_ID) as string;
  private readonly platformId = inject(PLATFORM_ID);

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

  readonly profileUrl = computed(() =>
    buildProfileShareUrl(this.userId(), this.localeId)
  );

  readonly saveStatus = signal<SaveStatus>('idle');
  readonly deletingAccount = signal(false);
  readonly deletePhraseInput = signal('');
  readonly deleteDialogError = signal('');

  /**
   * Last successfully persisted snapshot. Drafts are compared against this to
   * decide whether a save is needed. Updated on hydration from the server and
   * after every successful save round trip. While the user has unsaved edits,
   * the live Firestore listener will not overwrite their drafts.
   *
   * Stored as a signal so the dirty-derivation `computed` reacts to hydration
   * and save completion the same way it reacts to draft edits.
   */
  private readonly lastPersisted = signal<DraftSnapshot | null>(null);
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlightSave: Promise<void> | null = null;

  readonly config = computed<ResolvedConfig>(() => {
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
    // Hydrate drafts from server config. Skip while the user has dirty edits
    // or a save is mid-flight, otherwise the realtime listener would clobber
    // input the user is mid-typing.
    effect(() => {
      const cfg = this.config();
      if (!cfg) return;
      untracked(() => {
        const status = this.saveStatus();
        const baseline = this.lastPersisted();
        // "Dirty" = the user has local unsaved edits, i.e. drafts diverge
        // from the last snapshot we persisted. We compare drafts to the OLD
        // baseline, never to the incoming `cfg` (otherwise every server
        // update looks dirty and we'd never sync).
        const dirty =
          baseline !== null &&
          !this.snapshotsEqual(this.draftSnapshot(), baseline);
        if (
          baseline !== null &&
          (status === 'pending' || status === 'saving' || dirty)
        ) {
          return;
        }
        this.applyConfigToDrafts(cfg);
      });
    });

    // Auto-save effect: every draft change re-runs this effect, which
    // re-schedules the debounce timer. The whole side-effect block runs in
    // `untracked` so writes to `saveStatus` (status pill) don't loop back and
    // reset the debounce themselves.
    effect(() => {
      const draft = this.draftSnapshot();
      const baseline = this.lastPersisted();
      untracked(() => {
        if (baseline === null) return;
        if (this.snapshotsEqual(draft, baseline)) {
          this.cancelAutoSaveTimer();
          if (this.saveStatus() === 'pending') this.saveStatus.set('idle');
          return;
        }
        this.scheduleAutoSave();
      });
    });
  }

  ngOnDestroy(): void {
    this.cancelAutoSaveTimer();
    if (this.savedTimer !== null) {
      clearTimeout(this.savedTimer);
      this.savedTimer = null;
    }
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

  retrySave(): void {
    void this.flushSave();
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
    this.cancelAutoSaveTimer();

    this.deletingAccount.set(true);

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
      this.saveStatus.set('error');
    } finally {
      this.deletingAccount.set(false);
    }
  }

  private draftSnapshot(): DraftSnapshot {
    return {
      displayName: this.displayNameDraft().trim(),
      dailyGoal: Math.max(1, Math.trunc(this.dailyGoalDraft())),
      weeklyGoal: Math.max(1, Math.trunc(this.weeklyGoalDraft())),
      monthlyGoal: Math.max(1, Math.trunc(this.monthlyGoalDraft())),
      hideFromLeaderboard: this.leaderboardOptOutDraft(),
      publicProfile: this.publicProfileDraft(),
      adsConsent: this.adsConsentDraft(),
      snapQuality: this.snapQualityDraft(),
    };
  }

  private snapshotFromConfig(cfg: ResolvedConfig): DraftSnapshot {
    return {
      displayName: cfg.displayName.trim(),
      dailyGoal: cfg.dailyGoal,
      weeklyGoal: cfg.weeklyGoal,
      monthlyGoal: cfg.monthlyGoal,
      hideFromLeaderboard: cfg.hideFromLeaderboard,
      publicProfile: cfg.publicProfile,
      adsConsent: cfg.consent?.targetedAds ?? true,
      snapQuality: cfg.snapQuality,
    };
  }

  private snapshotsEqual(a: DraftSnapshot, b: DraftSnapshot): boolean {
    return (
      a.displayName === b.displayName &&
      a.dailyGoal === b.dailyGoal &&
      a.weeklyGoal === b.weeklyGoal &&
      a.monthlyGoal === b.monthlyGoal &&
      a.hideFromLeaderboard === b.hideFromLeaderboard &&
      a.publicProfile === b.publicProfile &&
      a.adsConsent === b.adsConsent &&
      a.snapQuality === b.snapQuality
    );
  }

  private applyConfigToDrafts(cfg: ResolvedConfig): void {
    this.displayNameDraft.set(cfg.displayName);
    this.dailyGoalDraft.set(cfg.dailyGoal);
    this.weeklyGoalDraft.set(cfg.weeklyGoal);
    this.monthlyGoalDraft.set(cfg.monthlyGoal);
    this.leaderboardOptOutDraft.set(cfg.hideFromLeaderboard);
    this.publicProfileDraft.set(cfg.publicProfile);
    this.adsConsentDraft.set(cfg.consent?.targetedAds ?? true);
    this.snapQualityDraft.set(cfg.snapQuality);
    this.lastPersisted.set(this.snapshotFromConfig(cfg));
    if (this.saveStatus() === 'pending') this.saveStatus.set('idle');
  }

  private scheduleAutoSave(): void {
    this.saveStatus.set('pending');
    this.cancelAutoSaveTimer();
    if (!isPlatformBrowser(this.platformId)) {
      // SSR: never schedule timers; the user can't interact anyway.
      return;
    }
    this.autoSaveTimer = setTimeout(() => {
      this.autoSaveTimer = null;
      void this.flushSave();
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  private cancelAutoSaveTimer(): void {
    if (this.autoSaveTimer !== null) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private async flushSave(): Promise<void> {
    if (this.inFlightSave) {
      // Coalesce: wait for the running save, then re-check for newer drafts.
      await this.inFlightSave;
      const draft = this.draftSnapshot();
      const baseline = this.lastPersisted();
      if (baseline && this.snapshotsEqual(draft, baseline)) return;
    }
    const run = this.performSave();
    this.inFlightSave = run;
    try {
      await run;
    } finally {
      if (this.inFlightSave === run) this.inFlightSave = null;
    }
  }

  private async performSave(): Promise<void> {
    this.cancelAutoSaveTimer();
    const draft = this.draftSnapshot();
    this.saveStatus.set('saving');
    try {
      const current = this.config();
      await this.userConfigStore.save({
        displayName: draft.displayName,
        dailyGoal: draft.dailyGoal,
        weeklyGoal: draft.weeklyGoal,
        monthlyGoal: draft.monthlyGoal,
        consent: {
          ...(current.consent ?? {}),
          targetedAds: draft.adsConsent,
        },
        ui: {
          hideFromLeaderboard: draft.hideFromLeaderboard,
          publicProfile: draft.publicProfile,
          snapQuality: draft.snapQuality,
        },
      });
      this.lastPersisted.set(draft);
      this.saveStatus.set('saved');
      this.trackAnalytics('settings_saved', {
        hideFromLeaderboard: draft.hideFromLeaderboard,
        publicProfile: draft.publicProfile,
        dailyGoal: draft.dailyGoal,
        weeklyGoal: draft.weeklyGoal,
        monthlyGoal: draft.monthlyGoal,
        adsConsent: draft.adsConsent,
      });
      if (this.savedTimer !== null) clearTimeout(this.savedTimer);
      this.savedTimer = setTimeout(() => {
        this.savedTimer = null;
        if (this.saveStatus() === 'saved') this.saveStatus.set('idle');
      }, SAVED_INDICATOR_MS);
    } catch {
      this.saveStatus.set('error');
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
