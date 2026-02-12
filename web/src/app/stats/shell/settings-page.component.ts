import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom } from 'rxjs';
import { UserConfigApiService } from '@nx-temp/stats-data-access';
import { UserContextService } from '../../user-context.service';

@Component({
  selector: 'app-settings-page',
  imports: [MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <main class="page-wrap">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Einstellungen</mat-card-title>
          <mat-card-subtitle>User-Profil & Tagesziel</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <section class="grid">
            <mat-form-field appearance="outline">
              <mat-label>User ID</mat-label>
              <input matInput [value]="userIdDraft()" (input)="userIdDraft.set(asValue($event))" placeholder="z.B. wolf" />
              <mat-hint>Wird für Multi-User-Zuordnung genutzt (Auth kommt später).</mat-hint>
            </mat-form-field>

            <div class="row">
              <button type="button" mat-stroked-button (click)="applyUserId()">
                <mat-icon>switch_account</mat-icon>
                User wechseln
              </button>
              <span class="pill">Aktiv: {{ activeUserId() }}</span>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Anzeigename</mat-label>
              <input matInput [value]="displayNameDraft()" (input)="displayNameDraft.set(asValue($event))" placeholder="Wolf" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Tagesziel (Reps)</mat-label>
              <input
                matInput
                type="number"
                min="1"
                [value]="dailyGoalDraft()"
                (input)="dailyGoalDraft.set(asNumber($event))"
                placeholder="100"
              />
            </mat-form-field>
          </section>

          @if (errorMessage()) {
            <p class="error" role="alert">{{ errorMessage() }}</p>
          }

          <div class="row">
            <button type="button" mat-flat-button [disabled]="saving()" (click)="save()">
              <mat-icon>save</mat-icon>
              Speichern
            </button>
            @if (saving()) {
              <span class="muted">Speichert…</span>
            }
            @if (saved()) {
              <span class="muted">Gespeichert.</span>
            }
          </div>
        </mat-card-content>
      </mat-card>
    </main>
  `,
  styles: `
    .page-wrap { max-width: 900px; margin: 0 auto; padding: 16px; display: grid; gap: 12px; }
    .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); align-items: start; }
    .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .pill { padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(123, 159, 255, 0.24); }
    .muted { opacity: 0.8; font-size: 0.9rem; }
    .error { color: #ffd8d8; }
  `,
})
export class SettingsPageComponent {
  private readonly api = inject(UserConfigApiService);
  private readonly user = inject(UserContextService);

  readonly activeUserId = this.user.userIdSafe;

  readonly userIdDraft = signal(this.activeUserId());
  readonly displayNameDraft = signal('');
  readonly dailyGoalDraft = signal<number>(100);

  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly errorMessage = signal('');

  readonly configResource = resource({
    params: () => ({ userId: this.activeUserId() }),
    loader: async ({ params }) => firstValueFrom(this.api.getConfig(params.userId)),
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
        }),
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
