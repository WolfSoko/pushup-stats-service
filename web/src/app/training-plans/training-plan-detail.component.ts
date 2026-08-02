import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  LOCALE_ID,
  PLATFORM_ID,
  signal,
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
import { findPlanBySlug } from '@pu-stats/models';
import { previewDayProgress } from './training-plan-detail.exercises';
import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { LogPlanDayResult, TrainingPlanStore } from './training-plan.store';
import {
  ExerciseToggle,
  PlanDayExercisesComponent,
} from './plan-day-exercises.component';
import {
  registerAutoStart,
  registerDayDeepLinkScroll,
} from './training-plan-detail.effects';
import {
  buildWeeks,
  formatSets,
  messageForLogResult,
} from './training-plan-detail.helpers';

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
    PlanDayExercisesComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './training-plan-detail.component.html',
  styleUrl: './training-plan-detail.component.css',
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

  protected readonly formatSets = formatSets;

  /** Hides the hero `<figure>` when the Unsplash image fails to load. */
  protected readonly heroImageFailed = signal(false);

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

  constructor() {
    registerDayDeepLinkScroll({
      isBrowser: this.isBrowser,
      host: this.host,
      queryParams: this.queryParamsSignal,
    });
    registerAutoStart({
      snackbar: this.snackbar,
      queryParams: this.queryParamsSignal,
      hasPlan: computed(() => this.plan() !== null),
      isThisPlanActive: computed(() => this.isThisPlanActive()),
      authResolved: this.authResolved,
      isAuthenticated: this.isAuthenticated,
      hasActivePlan: this.store.hasActivePlan,
      activePlanLoaded: this.store.activePlanLoaded,
      start: () => this.start(),
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
    const active = this.isThisPlanActive();
    return buildWeeks(
      plan,
      {
        currentDay: active ? this.store.currentDayIndex() : null,
        completed: new Set(
          active ? (this.store.activePlan()?.completedDays ?? []) : []
        ),
        skipped: new Set(
          active ? (this.store.activePlan()?.skippedDays ?? []) : []
        ),
        // An inactive plan still lists its exercises, just read-only and
        // at zero progress — the prescription is the main thing a visitor
        // came to see.
        exercisesFor: (dayIndex) =>
          active
            ? this.store.dayProgress(dayIndex)
            : previewDayProgress(plan, dayIndex),
      },
      this.locale
    );
  });

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
    this.reportLogResult(await this.store.logPlanDay(dayIndex));
  }

  async logExercise(dayIndex: number, itemIndex: number): Promise<void> {
    this.reportLogResult(await this.store.logPlanExercise(dayIndex, itemIndex));
  }

  async toggleExercise(dayIndex: number, event: ExerciseToggle): Promise<void> {
    await this.store.setItemDone(dayIndex, event.itemIndex, event.done);
  }

  private reportLogResult(result: LogPlanDayResult): void {
    const message = messageForLogResult(result);
    if (message) {
      this.snackbar.open(message, undefined, { duration: 3000 });
    }
  }
}
