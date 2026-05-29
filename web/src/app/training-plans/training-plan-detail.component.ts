import { isPlatformBrowser } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  LOCALE_ID,
  PLATFORM_ID,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthStore } from '@pu-auth/auth';
import {
  detectPushupTypes,
  findPlanBySlug,
  localizePushupType,
  localizePushupTypeSlug,
  PushupTypeInfo,
  TrainingPlanDay,
} from '@pu-stats/models';
import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { LogPlanDayResult, TrainingPlanStore } from './training-plan.store';

interface PushupTypeChip {
  slug: string;
  name: string;
  summary: string;
}

interface DayRow {
  day: TrainingPlanDay;
  weekIndex: number;
  isToday: boolean;
  isCompleted: boolean;
  isSkipped: boolean;
  isFuture: boolean;
  pushupTypes: ReadonlyArray<PushupTypeChip>;
}

@Component({
  selector: 'app-training-plan-detail',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule,
    PageHeaderComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (plan(); as p) {
      <main class="page-wrap">
        @if (p.heroImage && !heroImageFailed) {
          <figure class="plan-hero">
            <img
              [src]="p.heroImage"
              [alt]="p.title"
              loading="eager"
              decoding="async"
              width="1200"
              height="675"
              (error)="heroImageFailed = true"
            />
            @if (p.heroImageCredit) {
              <figcaption [innerHTML]="p.heroImageCredit"></figcaption>
            }
          </figure>
        }
        <app-page-header icon="fitness_center" variant="training">
          <h1 page-title>{{ p.title }}</h1>
          <p page-subtitle>{{ p.summary }}</p>
          <a
            page-actions
            mat-icon-button
            routerLink="/training-plans"
            aria-label="Zurück"
            i18n-aria-label="@@trainingPlans.back"
          >
            <mat-icon>arrow_back</mat-icon>
          </a>
        </app-page-header>

        <mat-chip-set class="meta-chips">
          <mat-chip
            >{{ p.totalDays }}
            <span i18n="@@trainingPlans.daysSuffix">Tage</span></mat-chip
          >
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
              <mat-progress-bar
                mode="determinate"
                [value]="store.completionPercent()"
              />
              @if (store.currentDayIndex(); as idx) {
                <p class="muted current-day">
                  <span i18n="@@trainingPlans.currentDay">Aktueller Tag:</span>
                  {{ idx }} / {{ p.totalDays }}
                </p>
              }
              <p class="muted goal-hint">
                <mat-icon aria-hidden="true">flag</mat-icon>
                <span i18n="@@trainingPlans.goalOverrideHint">
                  Tagesziel wird vom Plan gesetzt.
                </span>
                <a
                  routerLink="/settings"
                  fragment="targets"
                  i18n="@@trainingPlans.goalOverrideHint.cta"
                  >Manuelle Ziele anpassen</a
                >
              </p>
            </mat-card-content>
            <mat-card-actions align="end">
              <button
                mat-stroked-button
                color="warn"
                (click)="abandon()"
                i18n="@@trainingPlans.abandon"
              >
                <mat-icon>cancel</mat-icon>
                Plan beenden
              </button>
            </mat-card-actions>
          </mat-card>
        } @else if (authResolved()) {
          <mat-card class="status-card">
            <mat-card-content>
              @if (isAuthenticated()) {
                <p i18n="@@trainingPlans.startCta">
                  Starte den Plan und das Tagesziel im Dashboard wird
                  automatisch nach diesem Plan gesetzt.
                </p>
              } @else {
                <p i18n="@@trainingPlans.signupCta">
                  Erstelle ein kostenloses Konto, um diesen Plan zu starten. Wir
                  tracken deinen Fortschritt automatisch und setzen dein
                  Tagesziel passend zum Plan.
                </p>
                <ul class="signup-benefits">
                  <li i18n="@@trainingPlans.signupBenefit.tracking">
                    Automatische Fortschrittsverfolgung
                  </li>
                  <li i18n="@@trainingPlans.signupBenefit.goal">
                    Tagesziel passt sich täglich an deinen Plan an
                  </li>
                  <li i18n="@@trainingPlans.signupBenefit.streak">
                    Streaks, Statistiken und Bestenliste
                  </li>
                </ul>
              }
            </mat-card-content>
            <mat-card-actions align="end">
              @if (isAuthenticated()) {
                @if (store.hasActivePlan()) {
                  <p
                    class="muted warn-replace"
                    i18n="@@trainingPlans.replaceWarn"
                  >
                    Achtung: Dies ersetzt den aktuell aktiven Plan.
                  </p>
                }
                <button mat-flat-button color="primary" (click)="start()">
                  <mat-icon>play_arrow</mat-icon>
                  <span i18n="@@trainingPlans.start">Plan starten</span>
                </button>
              } @else {
                <a
                  mat-flat-button
                  color="primary"
                  [routerLink]="['/register']"
                  [queryParams]="signupQueryParams()"
                >
                  <mat-icon>person_add</mat-icon>
                  <span i18n="@@trainingPlans.signupAndStart"
                    >Konto erstellen & Plan starten</span
                  >
                </a>
                <a
                  mat-stroked-button
                  [routerLink]="['/login']"
                  [queryParams]="loginQueryParams()"
                  i18n="@@trainingPlans.loginAndStart"
                  >Schon Konto? Einloggen</a
                >
              }
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
                  [attr.id]="'day-' + row.day.dayIndex"
                  [class.today]="row.isToday"
                  [class.done]="row.isCompleted"
                  [class.skipped]="row.isSkipped"
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
                      <mat-icon aria-hidden="true"
                        >local_fire_department</mat-icon
                      >
                    } @else {
                      <mat-icon aria-hidden="true">fitness_center</mat-icon>
                    }
                  </div>
                  <div class="day-body">
                    <div class="day-title">
                      @if (row.day.kind === 'rest') {
                        <span i18n="@@trainingPlans.kind.rest">Ruhetag</span>
                      } @else if (row.day.kind === 'test') {
                        <span i18n="@@trainingPlans.kind.test"
                          >Maximaltest</span
                        >
                      } @else if (row.day.kind === 'light') {
                        <span i18n="@@trainingPlans.kind.light"
                          >Leichter Tag</span
                        >
                        @if (row.day.targetReps > 0) {
                          <span class="reps">
                            <span class="muted">·</span>
                            <strong>{{ row.day.targetReps }}</strong>
                            <span i18n="@@trainingPlans.reps">Wdh.</span>
                          </span>
                        }
                      } @else if (row.day.targetReps > 0) {
                        <span class="reps">
                          <strong>{{ row.day.targetReps }}</strong>
                          <span i18n="@@trainingPlans.reps">Wdh.</span>
                        </span>
                      }
                      @if (row.day.sets && row.day.sets.length > 1) {
                        <span class="sets muted">{{
                          formatSets(row.day.sets)
                        }}</span>
                      }
                    </div>
                    <div class="day-desc muted">{{ row.day.description }}</div>
                    @if (row.pushupTypes.length > 0) {
                      <div class="pushup-types">
                        @for (type of row.pushupTypes; track type.slug) {
                          <a
                            class="pushup-type-chip"
                            [routerLink]="[
                              '/wiki/liegestuetz-typen',
                              type.slug,
                            ]"
                            [matTooltip]="type.summary"
                            matTooltipPosition="above"
                          >
                            <mat-icon
                              class="pushup-type-icon"
                              aria-hidden="true"
                              >help_outline</mat-icon
                            >
                            <span>{{ type.name }}</span>
                          </a>
                        }
                      </div>
                    }
                  </div>
                  <div class="day-actions">
                    @if (
                      isThisPlanActive() &&
                      (row.day.kind !== 'rest' || !row.isToday)
                    ) {
                      <button
                        mat-icon-button
                        [matMenuTriggerFor]="dayMenu"
                        aria-label="Tagesaktionen öffnen"
                        i18n-aria-label="@@trainingPlans.menu.triggerAria"
                      >
                        @if (row.isCompleted) {
                          <mat-icon>check_circle</mat-icon>
                        } @else if (row.isSkipped) {
                          <mat-icon>skip_next</mat-icon>
                        } @else {
                          <mat-icon>more_vert</mat-icon>
                        }
                      </button>
                      <mat-menu #dayMenu="matMenu">
                        @if (row.day.kind !== 'rest') {
                          @if (row.isCompleted) {
                            <button
                              mat-menu-item
                              (click)="unmark(row.day.dayIndex)"
                            >
                              <mat-icon>undo</mat-icon>
                              <span i18n="@@trainingPlans.menu.undoDone"
                                >Erledigt rückgängig machen</span
                              >
                            </button>
                          } @else if (row.isSkipped) {
                            <button
                              mat-menu-item
                              (click)="unskip(row.day.dayIndex)"
                            >
                              <mat-icon>undo</mat-icon>
                              <span i18n="@@trainingPlans.menu.undoSkip"
                                >Überspringen rückgängig machen</span
                              >
                            </button>
                          } @else {
                            @if (row.day.targetReps > 0) {
                              <button
                                mat-menu-item
                                (click)="logPlanDay(row.day.dayIndex)"
                              >
                                <mat-icon color="primary"
                                  >check_circle</mat-icon
                                >
                                <span i18n="@@trainingPlans.menu.logDone"
                                  >Plan-Sätze eintragen & abhaken</span
                                >
                              </button>
                            }
                            <button
                              mat-menu-item
                              (click)="mark(row.day.dayIndex)"
                            >
                              <mat-icon>check</mat-icon>
                              <span i18n="@@trainingPlans.menu.markDone"
                                >Nur abhaken (ohne Eintrag)</span
                              >
                            </button>
                            <button
                              mat-menu-item
                              (click)="skip(row.day.dayIndex)"
                            >
                              <mat-icon>skip_next</mat-icon>
                              <span i18n="@@trainingPlans.menu.skip"
                                >Tag überspringen</span
                              >
                            </button>
                          }
                        }
                        @if (!row.isToday) {
                          <button
                            mat-menu-item
                            (click)="jumpToDay(row.day.dayIndex)"
                          >
                            <mat-icon>fast_forward</mat-icon>
                            <span i18n="@@trainingPlans.menu.jump"
                              >Zu diesem Tag springen</span
                            >
                          </button>
                        }
                      </mat-menu>
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
      app-page-header {
        display: block;
        margin-bottom: 16px;
      }
      .plan-hero {
        margin: 0 0 16px;
      }
      .plan-hero img {
        width: 100%;
        height: auto;
        aspect-ratio: 16 / 9;
        object-fit: cover;
        border-radius: 12px;
        display: block;
        background: rgba(0, 0, 0, 0.06);
      }
      .plan-hero figcaption {
        margin-top: 6px;
        font-size: 0.78rem;
        color: rgba(0, 0, 0, 0.55);
      }
      :host-context(.dark-theme) .plan-hero figcaption {
        color: rgba(255, 255, 255, 0.55);
      }
      .plan-hero figcaption a {
        color: inherit;
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
      .status-card mat-card-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
      }
      .progress-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .current-day {
        margin-top: 8px;
      }
      .goal-hint {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: 8px;
        font-size: 0.88rem;
      }
      .goal-hint mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
      .goal-hint a {
        color: var(--mat-sys-primary, #3f51b5);
      }
      .warn-replace {
        margin: 0 8px 0 0;
        color: var(--mat-sys-error, #d32f2f);
      }
      @media (max-width: 600px) {
        .status-card mat-card-actions {
          flex-direction: column;
          align-items: stretch;
        }
        .status-card mat-card-actions > a,
        .status-card mat-card-actions > button {
          width: 100%;
          margin: 0;
        }
        .warn-replace {
          margin: 0;
        }
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
        grid-template-columns: 32px 28px 1fr auto;
        gap: 10px;
        align-items: center;
        padding: 10px 12px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.04);
        scroll-margin-top: 80px;
      }
      .day-body {
        min-width: 0;
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
      .day-row.skipped {
        opacity: 0.55;
      }
      .day-row.skipped .day-num,
      .day-row.skipped .day-title,
      .day-row.skipped .day-desc {
        text-decoration: line-through;
      }
      .day-num {
        text-align: center;
        font-variant-numeric: tabular-nums;
      }
      .day-title {
        display: flex;
        flex-wrap: wrap;
        column-gap: 6px;
        row-gap: 2px;
        align-items: baseline;
      }
      .reps {
        display: inline-flex;
        gap: 4px;
        align-items: baseline;
        white-space: nowrap;
      }
      .sets {
        font-size: 0.85rem;
        white-space: nowrap;
      }
      .day-desc {
        font-size: 0.9rem;
      }
      .pushup-types {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }
      .pushup-type-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 10px 2px 6px;
        border-radius: 999px;
        background: rgba(63, 81, 181, 0.12);
        color: var(--mat-sys-primary, #3f51b5);
        font-size: 0.78rem;
        line-height: 1.4;
        text-decoration: none;
        white-space: nowrap;
      }
      .pushup-type-chip:hover,
      .pushup-type-chip:focus-visible {
        background: rgba(63, 81, 181, 0.2);
        text-decoration: underline;
      }
      .pushup-type-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
      :host-context(.dark-theme) .pushup-type-chip {
        background: rgba(159, 168, 218, 0.18);
        color: var(--mat-sys-primary, #9fa8da);
      }
      :host-context(.dark-theme) .pushup-type-chip:hover,
      :host-context(.dark-theme) .pushup-type-chip:focus-visible {
        background: rgba(159, 168, 218, 0.28);
      }
      .signup-benefits {
        margin: 12px 0 0;
        padding-left: 20px;
      }
      .signup-benefits li {
        margin-bottom: 4px;
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
  private readonly authStore = inject(AuthStore);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly isAuthenticated = this.authStore.isAuthenticated;
  protected readonly authResolved = this.authStore.authResolved;

  /** Hides the hero `<figure>` when the Unsplash image fails to load. */
  protected heroImageFailed = false;

  private readonly slugSignal = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly queryParamsSignal = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly plan = computed(() => {
    const slug = this.slugSignal().get('slug');
    return slug ? findPlanBySlug(slug) : null;
  });

  readonly signupQueryParams = computed(() => {
    const p = this.plan();
    return p
      ? { planId: p.id, returnUrl: `/training-plans/${p.slug}?autoStart=1` }
      : { returnUrl: '/training-plans' };
  });

  readonly loginQueryParams = computed(() => {
    const p = this.plan();
    // Intentionally NO `autoStart=1` here: a returning user logging back
    // in might already have a different active plan, and silently
    // replacing it would bypass the in-UI replacement warning shown for
    // manual starts. Send them back to the detail page so they can
    // explicitly confirm via "Plan starten".
    return p
      ? { returnUrl: `/training-plans/${p.slug}` }
      : { returnUrl: '/training-plans' };
  });

  private autoStartTriggered = false;

  constructor() {
    // Honour an incoming `?day=<index>` query param so deep-links from
    // the dashboard's plan banner scroll to the active day after route
    // hydration. Use `Element.scrollIntoView` (not `ViewportScroller`)
    // because the app shell wraps content in `<mat-sidenav-content>`,
    // which owns its own scroll container — `ViewportScroller` only
    // scrolls `window` and would silently no-op.
    //
    // We intentionally do NOT strip `?day=` after scrolling: keeping it
    // in the URL makes the deep-link bookmarkable and re-fires the
    // scroll on Back/Forward navigation, matching the `?type=` pattern
    // in the wiki pushup-types page.
    afterRenderEffect(() => {
      if (!this.isBrowser) return;
      const raw = this.queryParamsSignal().get('day');
      if (!raw) return;
      const target = document.getElementById(`day-${raw}`);
      if (target && this.host.nativeElement.contains(target)) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    effect(() => {
      const p = this.plan();
      const wantsAutoStart = this.queryParamsSignal().get('autoStart') === '1';
      // Defense-in-depth: even with `autoStart=1` (only set by the
      // signup flow), refuse to silently replace a *different* active
      // plan. Force the user through the manual flow that surfaces the
      // replacement warning. Also wait until the active-plan resource
      // has emitted at least once — otherwise during the initial-fetch
      // window `!isThisPlanActive()` is true even for a plan that's
      // already active, and we'd race the listener and overwrite it.
      const wouldReplaceDifferentPlan =
        this.store.hasActivePlan() && !this.isThisPlanActive();
      if (
        p &&
        wantsAutoStart &&
        this.authResolved() &&
        this.isAuthenticated() &&
        this.store.activePlanLoaded() &&
        !this.isThisPlanActive() &&
        !wouldReplaceDifferentPlan &&
        !this.autoStartTriggered
      ) {
        this.autoStartTriggered = true;
        // Surface failures with a snackbar so the user knows to retry
        // manually. The flag stays set to prevent a tight retry loop
        // inside this component instance — a manual reload will
        // re-attempt because `?autoStart=1` is still in the URL until
        // a successful start clears it.
        this.start().catch((error) => {
          console.error('Auto-start failed', error);
          this.snackbar.open(
            $localize`:@@trainingPlans.autoStartFailed:Plan-Start fehlgeschlagen — bitte erneut versuchen.`,
            undefined,
            { duration: 4000 }
          );
        });
      }
    });
  }

  readonly isThisPlanActive = computed(() => {
    const p = this.plan();
    const a = this.store.activePlan();
    return !!p && !!a && a.planId === p.id && a.status === 'active';
  });

  readonly weeks = computed(() => {
    const plan = this.plan();
    if (!plan) return [];
    const currentDay = this.isThisPlanActive()
      ? this.store.currentDayIndex()
      : null;
    const completed = this.isThisPlanActive()
      ? new Set(this.store.activePlan()?.completedDays ?? [])
      : new Set<number>();
    const skipped = this.isThisPlanActive()
      ? new Set(this.store.activePlan()?.skippedDays ?? [])
      : new Set<number>();

    const grouped = new Map<number, DayRow[]>();
    for (const day of plan.days) {
      const weekIndex = Math.floor((day.dayIndex - 1) / 7) + 1;
      const isToday = currentDay !== null && day.dayIndex === currentDay;
      const row: DayRow = {
        day,
        weekIndex,
        isToday,
        isCompleted: completed.has(day.dayIndex),
        isSkipped: skipped.has(day.dayIndex),
        isFuture: currentDay !== null && day.dayIndex > currentDay,
        pushupTypes: this.pushupTypeChipsForDay(day),
      };
      const list = grouped.get(weekIndex) ?? [];
      list.push(row);
      grouped.set(weekIndex, list);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekIndex, rows]) => ({ weekIndex, rows }));
  });

  private pushupTypeChipsForDay(
    day: TrainingPlanDay
  ): ReadonlyArray<PushupTypeChip> {
    if (day.kind === 'rest') return [];
    const matched: ReadonlyArray<PushupTypeInfo> = detectPushupTypes(
      day.description
    );
    return matched.map((type) => {
      const localized = localizePushupType(type, this.locale);
      return {
        slug: localizePushupTypeSlug(type, this.locale),
        name: localized.name,
        summary: localized.summary,
      };
    });
  }

  formatSets(sets: number[]): string {
    return `(${sets.join(' · ')})`;
  }

  async start(): Promise<void> {
    const p = this.plan();
    if (!p) return;
    if (!this.isAuthenticated()) {
      void this.router.navigate(['/register'], {
        queryParams: this.signupQueryParams(),
      });
      return;
    }
    await this.store.start(p.id);
    this.snackbar.open(
      $localize`:@@trainingPlans.started:Plan gestartet — viel Erfolg!`,
      undefined,
      { duration: 3000 }
    );
    if (this.queryParamsSignal().get('autoStart') === '1') {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { autoStart: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
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

  async skip(dayIndex: number): Promise<void> {
    await this.store.skipDay(dayIndex);
    this.snackbar.open(
      $localize`:@@trainingPlans.skipped:Tag übersprungen.`,
      undefined,
      { duration: 2000 }
    );
  }

  async unskip(dayIndex: number): Promise<void> {
    await this.store.unskipDay(dayIndex);
  }

  async jumpToDay(dayIndex: number): Promise<void> {
    await this.store.jumpToDay(dayIndex);
    this.snackbar.open(
      $localize`:@@trainingPlans.jumped:Auf Tag ${dayIndex}:INTERPOLATION: gesprungen.`,
      undefined,
      { duration: 2500 }
    );
  }

  async logPlanDay(dayIndex: number): Promise<void> {
    const result = await this.store.logPlanDay(dayIndex);
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
