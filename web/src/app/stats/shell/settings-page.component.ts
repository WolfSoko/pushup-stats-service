import {
  Component,
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
import { firstValueFrom } from 'rxjs';
import { UserConfigFirestoreService } from '@pu-stats/data-access';
import { UserContextService } from '../../user-context.service';

@Component({
  selector: 'app-settings-page',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
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
      gap: 12px;
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
    .error {
      color: #ffd8d8;
    }
  `,
})
export class SettingsPageComponent {
  // Switch to Firestore-based service for local/dev
  private readonly api = inject(UserConfigFirestoreService);
  private readonly user = inject(UserContextService);

  readonly activeUserId = this.user.userIdSafe;

  readonly displayNameDraft = signal('');
  readonly dailyGoalDraft = signal<number>(100);
  readonly leaderboardOptOutDraft = signal(false);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly errorMessage = signal('');

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
    } catch {
      this.errorMessage.set('Konnte nicht speichern.');
    } finally {
      this.saving.set(false);
      setTimeout(() => this.saved.set(false), 1500);
    }
  }
}
