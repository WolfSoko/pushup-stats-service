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
import { isPlanActive } from './training-plan-store.selectors';
import {
  ExerciseToggle,
  PlanDayExercisesComponent,
} from './plan-day-exercises.component';
import { planDayExpansion } from './plan-day-expansion';
import { PlanTodayCardComponent } from './plan-today-card.component';
import {
  registerAutoStart,
  registerDayDeepLinkScroll,
} from './training-plan-detail.effects';
import {
  formatSets,
  loginParamsFor,
  messageForLogResult,
  messageForResetResult,
  offersSession,
  sessionLinkFor,
  signupParamsFor,
  todayRowOf,
  weeksFor,
} from './training-plan-detail.helpers';
import { DayRow } from './training-plan-detail.models';

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
    PlanTodayCardComponent,
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

  readonly signupQueryParams = computed(() => signupParamsFor(this.plan()));

  readonly loginQueryParams = computed(() => loginParamsFor(this.plan()));

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

  readonly isThisPlanActive = computed(() =>
    isPlanActive(this.plan(), this.store.activePlan())
  );

  readonly weeks = computed(() =>
    weeksFor(
      this.plan(),
      {
        active: this.isThisPlanActive(),
        currentDayIndex: this.store.currentDayIndex(),
        completedDays: this.store.activePlan()?.completedDays ?? [],
        skippedDays: this.store.activePlan()?.skippedDays ?? [],
        dayProgress: (dayIndex) => this.store.dayProgress(dayIndex),
        previewProgress: previewDayProgress,
      },
      this.locale
    )
  );

  readonly sessionLink = computed(() =>
    sessionLinkFor(this.plan()?.slug ?? null)
  );

  protected readonly detailsLabel = $localize`:@@trainingPlans.toggleDayDetails:Tagesdetails ein-/ausklappen`;

  /** Collapse state of the week list's day rows. */
  protected readonly dayExpansion = planDayExpansion();

  /** Today's row, lifted out of the week list for the card at the top. */
  readonly todayRow = computed(() => todayRowOf(this.weeks()));

  protected readonly showSessionCta = (row: DayRow): boolean =>
    offersSession(row, this.isThisPlanActive());

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

  async resetExercise(dayIndex: number, itemIndex: number): Promise<void> {
    const message = messageForResetResult(
      await this.store.resetPlanExercise(dayIndex, itemIndex)
    );
    if (message) {
      this.snackbar.open(message, undefined, { duration: 3000 });
    }
  }

  private reportLogResult(result: LogPlanDayResult): void {
    const message = messageForLogResult(result);
    if (message) {
      this.snackbar.open(message, undefined, { duration: 3000 });
    }
  }
}
