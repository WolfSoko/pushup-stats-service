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
import { findPlanBySlug, localizeTrainingPlanContent } from '@pu-stats/models';
import { previewDayProgress } from './training-plan-detail.exercises';
import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { TrainingPlanStore } from './training-plan.store';
import { PlanStartService } from './plan-start.service';
import { PlanDayActionsService } from './plan-day-actions.service';
import { isPlanActive } from './training-plan-store.selectors';
import { PlanDayExercisesComponent } from './plan-day-exercises.component';
import { planDayExpansion } from './plan-day-expansion';
import { PlanTestInputComponent } from './plan-test-input.component';
import { PlanTodayCardComponent } from './plan-today-card.component';
import {
  registerAutoStart,
  registerDayDeepLinkScroll,
} from './training-plan-detail.effects';
import {
  formatSets,
  loginParamsFor,
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
    PlanTestInputComponent,
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
  private readonly planStart = inject(PlanStartService);
  /** Bound directly from the template — see `PlanDayActionsService`. */
  protected readonly dayActions = inject(PlanDayActionsService);
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

  /** The plan this route points at, exactly as the catalog ships it. */
  private readonly catalogPlan = computed(() => {
    const slug = this.slugSignal().get('slug');
    return slug ? findPlanBySlug(slug) : null;
  });

  /**
   * What the page renders. Once this is the user's active plan, that is
   * the store's rescaled copy — otherwise a user whose max test moved
   * their targets would read the catalog's numbers here and the adjusted
   * ones everywhere else.
   */
  readonly plan = computed(() =>
    isPlanActive(this.catalogPlan(), this.store.activePlan())
      ? (this.store.activeCatalog() ?? this.catalogPlan())
      : this.catalogPlan()
  );

  /** Long-form editorial copy (markdown-sourced), `null` until a plan ships it. */
  readonly aboutHtml = computed(() => {
    const p = this.plan();
    return p ? localizeTrainingPlanContent(p.slug, this.locale) : null;
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
    isPlanActive(this.catalogPlan(), this.store.activePlan())
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
        testResults: (dayIndex) => this.store.testResults(dayIndex),
        scaleFactors: this.store.scaleFactors(),
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

  /** Today's row, repeated by the card above the week list. */
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
    const result = await this.planStart.start(p);
    if (result === 'cancelled' || result === 'noop') return;
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
}
