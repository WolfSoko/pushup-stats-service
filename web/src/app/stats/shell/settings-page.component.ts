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
import { firstValueFrom } from 'rxjs';
import { UserConfigApiService } from '@pu-stats/data-access';
import { UserContextService } from '../../user-context.service';
import { FirebaseAuthService } from '../../firebase/firebase-auth.service';

@Component({
  selector: 'app-settings-page',
  imports: [
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
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
              <mat-label i18n="@@userIdLabel">User ID</mat-label>
              <input
                matInput
                [disabled]="authEnabled()"
                [value]="userIdDraft()"
                (input)="userIdDraft.set(asValue($event))"
                placeholder="z.B. wolf"
                i18n-placeholder="@@userIdPlaceholder"
              />
              <mat-hint i18n="@@userIdHint">
                @if (authEnabled()) {
                  Wird durch Login gesetzt.
                } @else {
                  Wird für Multi-User-Zuordnung genutzt (Auth kommt später).
                }
              </mat-hint>
            </mat-form-field>

            <div class="row">
              <button
                type="button"
                mat-stroked-button
                [disabled]="authEnabled()"
                (click)="applyUserId()"
                i18n="@@switchUser"
              >
                <mat-icon>switch_account</mat-icon>
                User wechseln
              </button>
              <span class="pill" i18n="@@activeUser"
                >Aktiv: {{ activeUserId() }}</span
              >
            </div>

            @if (authEnabled()) {
              <section class="auth-block">
                <div class="row">
                  <span class="pill" i18n="@@authStatus"
                    >Auth: {{ authUser() ? 'angemeldet' : 'abgemeldet' }}</span
                  >
                  @if (authUser()) {
                    <span class="muted">{{
                      authUser()?.email ?? authUser()?.uid
                    }}</span>
                  }
                </div>
                <div class="row">
                  <button
                    type="button"
                    mat-stroked-button
                    (click)="signIn('google')"
                  >
                    Google
                  </button>
                  <button
                    type="button"
                    mat-stroked-button
                    (click)="signIn('github')"
                  >
                    GitHub
                  </button>
                  <button
                    type="button"
                    mat-stroked-button
                    (click)="signIn('microsoft')"
                  >
                    Microsoft
                  </button>
                  <button
                    type="button"
                    mat-stroked-button
                    (click)="signIn('apple')"
                  >
                    Apple
                  </button>
                  <button type="button" mat-stroked-button disabled>
                    E‑Mail (coming soon)
                  </button>
                  @if (authUser()) {
                    <button
                      type="button"
                      mat-flat-button
                      color="warn"
                      (click)="signOut()"
                    >
                      Logout
                    </button>
                  }
                </div>
              </section>
            }

            <mat-form-field appearance="outline">
              <mat-label i18n="@@displayNameLabel">Anzeigename</mat-label>
              <input
                matInput
                [value]="displayNameDraft()"
                (input)="displayNameDraft.set(asValue($event))"
                placeholder="Wolf"
                i18n-placeholder="@@displayNamePlaceholder"
              />
            </mat-form-field>

            <mat-form-field appearance="outline">
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
    .auth-block {
      display: grid;
      gap: 8px;
      grid-column: 1 / -1;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid rgba(123, 159, 255, 0.2);
    }
    .pill {
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(123, 159, 255, 0.24);
    }
    .muted {
      opacity: 0.8;
      font-size: 0.9rem;
    }
    .error {
      color: #ffd8d8;
    }
  `,
})
export class SettingsPageComponent {
  private readonly api = inject(UserConfigApiService);
  private readonly user = inject(UserContextService);
  private readonly auth = inject(FirebaseAuthService, { optional: true });

  readonly activeUserId = this.user.userIdSafe;
  readonly authEnabled = computed(() => Boolean(this.auth?.enabled));
  readonly authUser = computed(() => this.auth?.user() ?? null);

  readonly userIdDraft = signal(this.activeUserId());
  readonly displayNameDraft = signal('');
  readonly dailyGoalDraft = signal<number>(100);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly errorMessage = signal('');

  readonly configResource = resource({
    params: () => ({ userId: this.activeUserId() }),
    loader: async ({ params }) =>
      firstValueFrom(this.api.getConfig(params.userId)),
  });

  readonly config = computed(() => this.configResource.value());

  constructor() {
    effect(() => {
      // keep draft user id in sync on user switches
      this.userIdDraft.set(this.activeUserId());
    });

    effect(() => {
      const cfg = this.config();
      if (!cfg) return;
      this.displayNameDraft.set(cfg.displayName ?? '');
      this.dailyGoalDraft.set(cfg.dailyGoal ?? 100);
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

  applyUserId(): void {
    this.user.setUserId(this.userIdDraft());
    this.configResource.reload();
  }

  async signIn(
    provider: 'google' | 'github' | 'microsoft' | 'apple'
  ): Promise<void> {
    if (!this.auth?.enabled) return;
    try {
      await this.auth.signInWithProvider(provider);
    } catch {
      this.errorMessage.set('Login fehlgeschlagen.');
    }
  }

  async signOut(): Promise<void> {
    if (!this.auth?.enabled) return;
    await this.auth.signOut();
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.saved.set(false);
    this.errorMessage.set('');

    const userId = this.activeUserId();
    const dailyGoal = Math.max(1, Number(this.dailyGoalDraft()));

    try {
      await firstValueFrom(
        this.api.updateConfig(userId, {
          displayName: this.displayNameDraft().trim(),
          dailyGoal,
        })
      );
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
