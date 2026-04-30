import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { localizePlan, TrainingPlanDay } from '@pu-stats/models';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { TrainingPlanStore } from './training-plan.store';

@Component({
  selector: 'app-training-plans-page',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page-wrap">
      <header class="page-header">
        <h1 i18n="@@trainingPlans.title">Trainingspläne</h1>
        <p class="muted" i18n="@@trainingPlans.intro">
          Strukturierte Pläne mit Tagesziel, Sätzen und automatischer
          Fortschrittsverfolgung. Starte einen Plan, und dein Tagesziel im
          Dashboard wird automatisch gesetzt.
        </p>
      </header>

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
            @if (
              todayLocalized();
              as today
            ) {
              @if (today.kind !== 'rest' && !store.todayDone()) {
                <button
                  mat-flat-button
                  type="button"
                  color="primary"
                  (click)="logToday()"
                >
                  <mat-icon>play_circle</mat-icon>
                  <span i18n="@@trainingPlans.logToday"
                    >Heute eintragen</span
                  >
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
      }
      .page-header h1 {
        margin: 0 0 4px;
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
      .plan-card mat-card-content {
        min-height: 64px;
      }
    `,
  ],
})
export class TrainingPlansPageComponent {
  readonly store = inject(TrainingPlanStore);
  private readonly locale = inject(LOCALE_ID) as string;

  /** Catalog with `title`/`summary` fields swapped to the active locale. */
  readonly localizedPlans = computed(() =>
    this.store.allPlans().map((p) => {
      const localized = localizePlan(p, this.locale);
      return {
        id: p.id,
        slug: p.slug,
        level: p.level,
        totalDays: p.totalDays,
        title: localized.title,
        summary: localized.summary,
      };
    })
  );

  /** Active plan card view-model — null when no plan is active. */
  readonly activeView = computed(() => {
    const cat = this.store.activeCatalog();
    if (!cat || !this.store.hasActivePlan()) return null;
    const localized = localizePlan(cat, this.locale);
    return {
      title: localized.title,
      summary: localized.summary,
      totalDays: cat.totalDays,
    };
  });

  /** Today's day with localized description. */
  readonly todayLocalized = computed<TrainingPlanDay | null>(() => {
    const day = this.store.todayDay();
    const cat = this.store.activeCatalog();
    if (!day || !cat) return null;
    const localized = localizePlan(cat, this.locale).days.find(
      (d) => d.dayIndex === day.dayIndex
    );
    return localized ?? day;
  });

  abandon(): void {
    void this.store.abandon();
  }

  logToday(): void {
    void this.store.logTodayPlanDay();
  }
}
