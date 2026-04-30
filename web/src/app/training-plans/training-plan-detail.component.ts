import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { findPlanBySlug, localizePlan, TrainingPlanDay } from '@pu-stats/models';
import { TrainingPlanStore } from './training-plan.store';

interface DayRow {
  day: TrainingPlanDay;
  weekIndex: number;
  isToday: boolean;
  isCompleted: boolean;
  isFuture: boolean;
}

@Component({
  selector: 'app-training-plan-detail',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (plan(); as p) {
      <main class="page-wrap">
        <header class="page-header">
          <a mat-icon-button routerLink="/training-plans" aria-label="Zurück" i18n-aria-label="@@trainingPlans.back">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <div>
            <h1>{{ localized()?.title }}</h1>
            <p class="muted">{{ localized()?.summary }}</p>
          </div>
        </header>

        <mat-chip-set class="meta-chips">
          <mat-chip>{{ p.totalDays }} <span i18n="@@trainingPlans.daysSuffix">Tage</span></mat-chip>
          <mat-chip>
            @if (p.level === 'beginner') {
              <span i18n="@@trainingPlans.level.beginner">Einsteiger</span>
            } @else if (p.level === 'intermediate') {
              <span i18n="@@trainingPlans.level.intermediate">Mittelstufe</span>
            } @else {
              <span i18n="@@trainingPlans.level.advanced">Fortgeschritten</span>
            }
          </mat-chip>
        </mat-chip-set>

        @if (isThisPlanActive()) {
          <mat-card class="status-card">
            <mat-card-content>
              <div class="progress-row">
                <span i18n="@@trainingPlans.progress">Fortschritt</span>
                <strong>{{ store.completionPercent() }}%</strong>
              </div>
              <mat-progress-bar mode="determinate" [value]="store.completionPercent()" />
              @if (store.currentDayIndex(); as idx) {
                <p class="muted current-day">
                  <span i18n="@@trainingPlans.currentDay">Aktueller Tag:</span>
                  {{ idx }} / {{ p.totalDays }}
                </p>
              }
            </mat-card-content>
            <mat-card-actions align="end">
              <button mat-stroked-button color="warn" (click)="abandon()" i18n="@@trainingPlans.abandon">
                <mat-icon>cancel</mat-icon>
                Plan beenden
              </button>
            </mat-card-actions>
          </mat-card>
        } @else {
          <mat-card class="status-card">
            <mat-card-content>
              <p i18n="@@trainingPlans.startCta">
                Starte den Plan und das Tagesziel im Dashboard wird automatisch nach diesem Plan gesetzt.
              </p>
            </mat-card-content>
            <mat-card-actions align="end">
              @if (store.hasActivePlan()) {
                <p class="muted warn-replace" i18n="@@trainingPlans.replaceWarn">
                  Achtung: Dies ersetzt den aktuell aktiven Plan.
                </p>
              }
              <button mat-flat-button color="primary" (click)="start()">
                <mat-icon>play_arrow</mat-icon>
                <span i18n="@@trainingPlans.start">Plan starten</span>
              </button>
            </mat-card-actions>
          </mat-card>
        }

        @for (week of weeks(); track week.weekIndex) {
          <section class="week">
            <h2>
              <span i18n="@@trainingPlans.week">Woche</span>
              {{ week.weekIndex }}
            </h2>
            <ul class="day-list">
              @for (row of week.rows; track row.day.dayIndex) {
                <li
                  class="day-row"
                  [class.today]="row.isToday"
                  [class.done]="row.isCompleted"
                  [class.future]="row.isFuture"
                >
                  <div class="day-num">
                    <strong>{{ row.day.dayIndex }}</strong>
                  </div>
                  <div class="day-icon">
                    @if (row.day.kind === 'rest') {
                      <mat-icon aria-hidden="true">self_improvement</mat-icon>
                    } @else if (row.day.kind === 'light') {
                      <mat-icon aria-hidden="true">directions_walk</mat-icon>
                    } @else if (row.day.kind === 'test') {
                      <mat-icon aria-hidden="true">local_fire_department</mat-icon>
                    } @else {
                      <mat-icon aria-hidden="true">fitness_center</mat-icon>
                    }
                  </div>
                  <div class="day-body">
                    <div class="day-title">
                      @if (row.day.kind === 'rest') {
                        <span i18n="@@trainingPlans.kind.rest">Ruhetag</span>
                      } @else if (row.day.kind === 'test') {
                        <span i18n="@@trainingPlans.kind.test">Maximaltest</span>
                      } @else if (row.day.kind === 'light') {
                        <span i18n="@@trainingPlans.kind.light">Leichter Tag</span>
                        @if (row.day.targetReps > 0) {
                          <span class="muted">·</span>
                          <strong>{{ row.day.targetReps }}</strong>
                          <span i18n="@@trainingPlans.reps">Wdh.</span>
                        }
                      } @else if (row.day.targetReps > 0) {
                        <strong>{{ row.day.targetReps }}</strong>
                        <span i18n="@@trainingPlans.reps">Wdh.</span>
                      }
                      @if (row.day.sets && row.day.sets.length > 1) {
                        <span class="sets muted">{{ formatSets(row.day.sets) }}</span>
                      }
                    </div>
                    <div class="day-desc muted">{{ row.day.description }}</div>
                  </div>
                  <div class="day-actions">
                    @if (isThisPlanActive() && row.day.kind !== 'rest') {
                      @if (row.isCompleted) {
                        <button
                          mat-icon-button
                          (click)="unmark(row.day.dayIndex)"
                          aria-label="Als nicht erledigt markieren"
                          i18n-aria-label="@@trainingPlans.unmarkAria"
                        >
                          <mat-icon>check_circle</mat-icon>
                        </button>
                      } @else {
                        <button
                          mat-icon-button
                          (click)="mark(row.day.dayIndex)"
                          aria-label="Als erledigt markieren"
                          i18n-aria-label="@@trainingPlans.markAria"
                        >
                          <mat-icon>radio_button_unchecked</mat-icon>
                        </button>
                      }
                    }
                  </div>
                </li>
              }
            </ul>
          </section>
        }
      </main>
    } @else {
      <main class="page-wrap">
        <p i18n="@@trainingPlans.notFound">Plan nicht gefunden.</p>
        <a mat-stroked-button routerLink="/training-plans">
          <mat-icon>arrow_back</mat-icon>
          <span i18n="@@trainingPlans.back">Zurück</span>
        </a>
      </main>
    }
  `,
  styles: [
    `
      .page-wrap {
        max-width: 980px;
        margin: 0 auto;
        padding: 16px;
      }
      .page-header {
        display: flex;
        gap: 8px;
        align-items: flex-start;
      }
      .page-header h1 {
        margin: 0;
      }
      .muted {
        color: rgba(0, 0, 0, 0.6);
      }
      :host-context(.dark-theme) .muted {
        color: rgba(255, 255, 255, 0.6);
      }
      .meta-chips {
        margin: 12px 0;
      }
      .status-card {
        margin: 16px 0;
      }
      .progress-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .current-day {
        margin-top: 8px;
      }
      .warn-replace {
        margin: 0 8px 0 0;
        color: var(--mat-sys-error, #d32f2f);
      }
      .week h2 {
        margin: 24px 0 8px;
      }
      .day-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 8px;
      }
      .day-row {
        display: grid;
        grid-template-columns: 40px 36px 1fr 48px;
        gap: 12px;
        align-items: center;
        padding: 10px 12px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.04);
      }
      :host-context(.dark-theme) .day-row {
        background: rgba(255, 255, 255, 0.04);
      }
      .day-row.today {
        outline: 2px solid var(--mat-sys-primary, #3f51b5);
      }
      .day-row.done {
        opacity: 0.7;
      }
      .day-row.done .day-actions mat-icon {
        color: var(--mat-sys-primary, #3f51b5);
      }
      .day-row.future {
        opacity: 0.85;
      }
      .day-num {
        text-align: center;
        font-variant-numeric: tabular-nums;
      }
      .day-title {
        display: flex;
        gap: 6px;
        align-items: baseline;
      }
      .sets {
        margin-left: 4px;
        font-size: 0.85rem;
      }
      .day-desc {
        font-size: 0.9rem;
      }
    `,
  ],
})
export class TrainingPlanDetailComponent {
  protected readonly store = inject(TrainingPlanStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackbar = inject(MatSnackBar);
  private readonly locale = inject(LOCALE_ID) as string;

  private readonly slugSignal = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  readonly plan = computed(() => {
    const slug = this.slugSignal().get('slug');
    return slug ? findPlanBySlug(slug) : null;
  });

  /** Plan with title/summary/day descriptions in the active locale. */
  readonly localized = computed(() => {
    const p = this.plan();
    return p ? localizePlan(p, this.locale) : null;
  });

  readonly isThisPlanActive = computed(() => {
    const p = this.plan();
    const a = this.store.activePlan();
    return !!p && !!a && a.planId === p.id && a.status === 'active';
  });

  readonly weeks = computed(() => {
    const localized = this.localized();
    if (!localized) return [];
    const currentDay = this.isThisPlanActive() ? this.store.currentDayIndex() : null;
    const completed = this.isThisPlanActive()
      ? new Set(this.store.activePlan()?.completedDays ?? [])
      : new Set<number>();

    const grouped = new Map<number, DayRow[]>();
    for (const day of localized.days) {
      const weekIndex = Math.floor((day.dayIndex - 1) / 7) + 1;
      const isToday = currentDay !== null && day.dayIndex === currentDay;
      const row: DayRow = {
        day,
        weekIndex,
        isToday,
        isCompleted: completed.has(day.dayIndex),
        isFuture: currentDay !== null && day.dayIndex > currentDay,
      };
      const list = grouped.get(weekIndex) ?? [];
      list.push(row);
      grouped.set(weekIndex, list);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekIndex, rows]) => ({ weekIndex, rows }));
  });

  formatSets(sets: number[]): string {
    return `(${sets.join(' · ')})`;
  }

  async start(): Promise<void> {
    const p = this.plan();
    if (!p) return;
    await this.store.start(p.id);
    this.snackbar.open(
      $localize`:@@trainingPlans.started:Plan gestartet — viel Erfolg!`,
      undefined,
      { duration: 3000 }
    );
  }

  async abandon(): Promise<void> {
    await this.store.abandon();
    this.snackbar.open(
      $localize`:@@trainingPlans.abandoned:Plan beendet.`,
      undefined,
      { duration: 3000 }
    );
    void this.router.navigate(['/training-plans']);
  }

  async mark(dayIndex: number): Promise<void> {
    await this.store.markDayDone(dayIndex);
  }

  async unmark(dayIndex: number): Promise<void> {
    await this.store.unmarkDayDone(dayIndex);
  }
}
