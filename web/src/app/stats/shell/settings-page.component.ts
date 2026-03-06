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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { UserConfigFirestoreService } from '@pu-stats/data-access';
import { UserContextService } from '../../user-context.service';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AuthStore } from '@pu-auth/auth';
import { Router } from '@angular/router';
import { Analytics, logEvent } from '@angular/fire/analytics';

@Component({
  selector: 'app-settings-page',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatDialogModule,
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
  `,
})
export class SettingsPageComponent {
  // Switch to Firestore-based service for local/dev
  private readonly api = inject(UserConfigFirestoreService);
  private readonly user = inject(UserContextService);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly analytics = inject(Analytics, { optional: true });

  readonly activeUserId = this.user.userIdSafe;

  readonly displayNameDraft = signal('');
  readonly dailyGoalDraft = signal<number>(100);
  readonly leaderboardOptOutDraft = signal(false);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly deletingAccount = signal(false);
  readonly errorMessage = signal('');
  readonly deletePhraseInput = signal('');
  readonly deleteDialogError = signal('');

  readonly configResource = resource({
    params: () => ({ userId: this.activeUserId() }),
    loader: async ({ params }) => {
      const result = await firstValueFrom(this.api.getConfig(params.userId));
      return (result ?? {}) as {
        displayName?: string;
        dailyGoal?: number;
        ui?: { hideFromLeaderboard?: boolean };
      };
    },
  });

  readonly config = computed(() => {
    const val = this.configResource.value();
    if (!val || typeof val !== 'object')
      return { displayName: '', dailyGoal: 100, hideFromLeaderboard: false };
    return {
      displayName: (val as { displayName?: string }).displayName ?? '',
      dailyGoal: (val as { dailyGoal?: number }).dailyGoal ?? 100,
      hideFromLeaderboard:
        (val as { ui?: { hideFromLeaderboard?: boolean } }).ui
          ?.hideFromLeaderboard ?? false,
    };
  });

  constructor() {
    effect(() => {
      const cfg = this.config();
      if (!cfg) return;
      this.displayNameDraft.set(cfg.displayName ?? '');
      this.dailyGoalDraft.set(cfg.dailyGoal ?? 100);
      this.leaderboardOptOutDraft.set(cfg.hideFromLeaderboard ?? false);
    });
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
      await this.api.updateConfig(userId, {
        displayName: this.displayNameDraft().trim(),
        dailyGoal,
        ui: {
          hideFromLeaderboard: this.leaderboardOptOutDraft(),
        },
      });
      this.saved.set(true);
      this.configResource.reload();
      this.trackAnalytics('settings_saved', {
        hideFromLeaderboard: this.leaderboardOptOutDraft(),
        dailyGoal,
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
      await this.api.updateConfig(userId, {
        displayName: 'Gelöschter Benutzer',
        email: null,
        ui: {
          hideFromLeaderboard: true,
        },
      });
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
