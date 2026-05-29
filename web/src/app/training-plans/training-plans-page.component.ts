import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { TrainingPlanDay } from '@pu-stats/models';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { AuthStore } from '@pu-auth/auth';
import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { LogPlanDayResult, TrainingPlanStore } from './training-plan.store';

@Component({
  selector: 'app-training-plans-page',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatSnackBarModule,
    PageHeaderComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page-wrap">
      <app-page-header icon="fitness_center" variant="training">
        <h1 page-title i18n="@@trainingPlans.title">Trainingspläne</h1>
        <p page-subtitle i18n="@@trainingPlans.intro">
          Strukturierte Pläne mit Tagesziel, Sätzen und automatischer
          Fortschrittsverfolgung. Starte einen Plan, und dein Tagesziel im
          Dashboard wird automatisch gesetzt.
        </p>
      </app-page-header>

      @if (!isAuthenticated() && authResolved()) {
        <mat-card class="signup-banner">
          <mat-card-content>
            <div class="signup-banner-content">
              <mat-icon class="signup-icon">person_add</mat-icon>
              <div>
                <h2 i18n="@@trainingPlans.banner.title">
                  Plan auswählen, Konto erstellen, durchstarten
                </h2>
                <p i18n="@@trainingPlans.banner.body">
                  Suche dir unten einen Plan aus. Mit einem kostenlosen Konto
                  tracken wir deinen Fortschritt automatisch und passen dein
                  Tagesziel an den gewählten Plan an.
                </p>
              </div>
            </div>
          </mat-card-content>
          <mat-card-actions align="end">
            <a
              mat-stroked-button
              routerLink="/login"
              [queryParams]="{ returnUrl: '/training-plans' }"
              i18n="@@trainingPlans.banner.login"
              >Einloggen</a
            >
            <a
              mat-flat-button
              color="primary"
              routerLink="/register"
              [queryParams]="{ returnUrl: '/training-plans' }"
              i18n="@@trainingPlans.banner.signup"
              >Kostenlos registrieren</a
            >
          </mat-card-actions>
        </mat-card>
      }

      @if (activeView(); as active) {
        <mat-card class="active-plan">
          <mat-card-header>
            <mat-card-title i18n="@@trainingPlans.active.title">
              Aktiver Plan
            </mat-card-title>
            <mat-card-subtitle>{{ active.title }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <p class="muted">{{ active.summary }}</p>

            @if (store.currentDayIndex(); as idx) {
              <div class="progress-row">
                <span i18n="@@trainingPlans.day">Tag</span>
                <strong>{{ idx }} / {{ active.totalDays }}</strong>
              </div>
              <mat-progress-bar
                mode="determinate"
                [value]="store.completionPercent()"
              />
            }

            @if (todayLocalized(); as today) {
              <div class="today-card">
                <div class="today-kind">
                  @if (today.kind === 'rest') {
                    <mat-icon>self_improvement</mat-icon>
                    <span i18n="@@trainingPlans.kind.rest">Ruhetag</span>
                  } @else if (today.kind === 'light') {
                    <mat-icon>directions_walk</mat-icon>
                    <span i18n="@@trainingPlans.kind.light">Leichter Tag</span>
                  } @else if (today.kind === 'test') {
                    <mat-icon>local_fire_department</mat-icon>
                    <span i18n="@@trainingPlans.kind.test">Maximaltest</span>
                  } @else {
                    <mat-icon>fitness_center</mat-icon>
                    <span i18n="@@trainingPlans.kind.main">Trainingstag</span>
                  }
                </div>
                @if (today.targetReps > 0) {
                  <div class="today-target">
                    <span i18n="@@trainingPlans.todayTarget"
                      >Heute geplant:</span
                    >
                    <strong>{{ today.targetReps }}</strong>
                    <span i18n="@@trainingPlans.reps">Wdh.</span>
                  </div>
                }
                <p class="muted today-desc">{{ today.description }}</p>
              </div>
            }
          </mat-card-content>
          <mat-card-actions align="end">
            <button
              mat-stroked-button
              type="button"
              color="warn"
              (click)="abandon()"
              i18n="@@trainingPlans.abandon"
            >
              <mat-icon>cancel</mat-icon>
              Plan beenden
            </button>
            @if (todayLocalized(); as today) {
              @if (
                today.kind !== 'rest' &&
                today.targetReps > 0 &&
                !store.todayDone()
              ) {
                <button
                  mat-flat-button
                  type="button"
                  color="primary"
                  (click)="logToday()"
                >
                  <mat-icon>play_circle</mat-icon>
                  <span i18n="@@trainingPlans.logToday">Heute eintragen</span>
                </button>
              }
            }
            <a
              mat-flat-button
              [routerLink]="['/training-plans', store.activeCatalog()?.slug]"
            >
              <mat-icon>open_in_full</mat-icon>
              <span i18n="@@trainingPlans.openDetail">Details öffnen</span>
            </a>
          </mat-card-actions>
        </mat-card>
      }

      <section class="plan-grid">
        @for (plan of localizedPlans(); track plan.id) {
          <mat-card class="plan-card">
            @if (plan.heroImage && !failedImages.has(plan.id)) {
              <a
                [routerLink]="['/training-plans', plan.slug]"
                class="card-media"
                [attr.aria-label]="plan.title"
              >
                <img
                  [src]="plan.heroImage"
                  [alt]="plan.title"
                  loading="lazy"
                  decoding="async"
                  (error)="onImageError(plan.id)"
                />
              </a>
            }
            <mat-card-header>
              <mat-card-title>{{ plan.title }}</mat-card-title>
              <mat-card-subtitle>
                <mat-chip-set>
                  <mat-chip [highlighted]="true">
                    {{ plan.totalDays }}
                    <span i18n="@@trainingPlans.daysSuffix">Tage</span>
                  </mat-chip>
                  <mat-chip>
                    @if (plan.level === 'beginner') {
                      <span i18n="@@trainingPlans.level.beginner"
                        >Einsteiger</span
                      >
                    } @else if (plan.level === 'intermediate') {
                      <span i18n="@@trainingPlans.level.intermediate"
                        >Mittelstufe</span
                      >
                    } @else {
                      <span i18n="@@trainingPlans.level.advanced"
                        >Fortgeschritten</span
                      >
                    }
                  </mat-chip>
                </mat-chip-set>
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <p>{{ plan.summary }}</p>
            </mat-card-content>
            <mat-card-actions align="end">
              <a
                mat-stroked-button
                [routerLink]="['/training-plans', plan.slug]"
              >
                <mat-icon>visibility</mat-icon>
                <span i18n="@@trainingPlans.viewPlan">Plan ansehen</span>
              </a>
            </mat-card-actions>
          </mat-card>
        }
      </section>
    </main>
  `,
  styles: [
    `
      .page-wrap {
        max-width: 980px;
        margin: 0 auto;
        padding: 16px;
        display: grid;
        gap: 16px;
      }
      .muted {
        color: rgba(0, 0, 0, 0.6);
      }
      :host-context(.dark-theme) .muted {
        color: rgba(255, 255, 255, 0.6);
      }
      .active-plan {
        margin-bottom: 24px;
        border-left: 4px solid var(--mat-sys-primary, #3f51b5);
      }
      .progress-row {
        display: flex;
        gap: 8px;
        align-items: baseline;
        margin: 12px 0 4px;
      }
      .today-card {
        margin-top: 16px;
        padding: 12px 16px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.04);
      }
      :host-context(.dark-theme) .today-card {
        background: rgba(255, 255, 255, 0.05);
      }
      .today-kind {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 500;
      }
      .today-target {
        margin-top: 8px;
        font-size: 1.2rem;
        display: flex;
        gap: 6px;
        align-items: baseline;
      }
      .today-desc {
        margin: 6px 0 0;
      }
      .plan-grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      }
      .plan-card {
        overflow: hidden;
      }
      .plan-card mat-card-content {
        min-height: 64px;
      }
      .card-media {
        display: block;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.06);
      }
      .card-media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 200ms ease;
      }
      .card-media:hover img,
      .card-media:focus-visible img {
        transform: scale(1.03);
      }
      .signup-banner {
        margin-bottom: 24px;
        border-left: 4px solid var(--mat-sys-primary, #3f51b5);
      }
      .signup-banner-content {
        display: flex;
        gap: 16px;
        align-items: flex-start;
      }
      .signup-icon {
        font-size: 32px;
        height: 32px;
        width: 32px;
        flex-shrink: 0;
      }
      .signup-banner h2 {
        margin: 0 0 4px;
        font-size: 1.1rem;
      }
    `,
  ],
})
export class TrainingPlansPageComponent {
  readonly store = inject(TrainingPlanStore);
  private readonly snackbar = inject(MatSnackBar);
  private readonly authStore = inject(AuthStore);

  readonly isAuthenticated = this.authStore.isAuthenticated;
  readonly authResolved = this.authStore.authResolved;

  /** Catalog with `title`/`summary` already localised via $localize. */
  readonly localizedPlans = computed(() =>
    this.store.allPlans().map((p) => ({
      id: p.id,
      slug: p.slug,
      level: p.level,
      totalDays: p.totalDays,
      title: p.title,
      summary: p.summary,
      heroImage: p.heroImage,
    }))
  );

  /** Plan ids whose hero image failed to load — hides the broken `<img>`. */
  readonly failedImages = new Set<string>();

  onImageError(id: string): void {
    this.failedImages.add(id);
  }

  /** Active plan card view-model — null when no plan is active. */
  readonly activeView = computed(() => {
    const cat = this.store.activeCatalog();
    if (!cat || !this.store.hasActivePlan()) return null;
    return {
      title: cat.title,
      summary: cat.summary,
      totalDays: cat.totalDays,
    };
  });

  /** Today's day; `description` is already localised via $localize. */
  readonly todayLocalized = computed<TrainingPlanDay | null>(
    () => this.store.todayDay() ?? null
  );

  abandon(): void {
    void this.store.abandon();
  }

  async logToday(): Promise<void> {
    const result = await this.store.logTodayPlanDay();
    const message = this.messageForLogResult(result);
    if (message) {
      this.snackbar.open(message, undefined, { duration: 3000 });
    }
  }

  private messageForLogResult(result: LogPlanDayResult): string | null {
    switch (result) {
      case 'logged':
        return $localize`:@@trainingPlans.logged:Plan-Sätze wurden eingetragen.`;
      case 'already-logged':
        return $localize`:@@trainingPlans.alreadyLogged:Tag war schon eingetragen — als erledigt markiert.`;
      case 'not-ready':
        return $localize`:@@trainingPlans.notReady:Daten werden noch geladen, bitte gleich noch einmal versuchen.`;
      case 'in-flight':
      case 'noop':
        return null;
    }
  }
}
