import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  PLATFORM_ID,
  REQUEST,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink } from '@angular/router';
import {
  createWeekRange,
  type ExerciseCategoryId,
  EXERCISE_CATEGORIES,
} from '@pu-stats/models';
import { LiveDataStore } from '@pu-stats/data-access';
import { FilterBarComponent } from '../components/filter-bar/filter-bar.component';
import { PreviewBannerComponent } from '../components/preview-banner/preview-banner.component';
import { AnalysisStore, type AnalysisView } from '../analysis.store';
import { categoryDisplayName } from '../i18n/exercise-display-names';
import { PageHeaderComponent } from '../../core/page-header/page-header.component';
import { AnalysisGroupViewComponent } from './analysis-group-view.component';
import { AnalysisOverviewComponent } from './analysis-overview.component';

const VALID_VIEWS: ReadonlySet<AnalysisView> = new Set<AnalysisView>([
  'overview',
  ...EXERCISE_CATEGORIES.map((c) => c.id),
]);

interface VisibleTab {
  id: ExerciseCategoryId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-analysis-page',
  providers: [AnalysisStore],
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatTabsModule,
    RouterLink,
    AnalysisGroupViewComponent,
    AnalysisOverviewComponent,
    FilterBarComponent,
    PageHeaderComponent,
    PreviewBannerComponent,
  ],
  template: `
    <main class="page-wrap">
      <app-preview-banner />

      <app-page-header icon="insights" variant="analysis">
        <h1 page-title i18n="@@analysisHeaderTitle">Analyse</h1>
        <p page-subtitle i18n="@@analysisHeaderSubtitle">
          Trends, Verteilungen und Streaks deines Trainings auf einen Blick.
        </p>
      </app-page-header>

      <section class="filter-section">
        <app-filter-bar
          [from]="store.from()"
          [to]="store.to()"
          (fromChange)="store.setFrom($event)"
          (toChange)="store.setTo($event)"
        />
      </section>

      @if (showEmptyCta()) {
        <mat-card class="empty-cta" data-testid="analysis-empty-cta">
          <mat-card-content>
            <mat-icon aria-hidden="true">insights</mat-icon>
            <div>
              <strong i18n="@@analysis.empty.title"
                >Noch keine Daten zum Analysieren.</strong
              >
              <p i18n="@@analysis.empty.body">
                Starte einen Trainingsplan oder trage deinen ersten Satz ein —
                dann zeigen wir dir hier Trends und Streaks.
              </p>
            </div>
            <a
              mat-flat-button
              color="primary"
              routerLink="/training-plans"
              data-testid="analysis-empty-cta-plans"
              i18n="@@analysis.empty.cta"
            >
              <mat-icon aria-hidden="true">fitness_center</mat-icon>
              Trainingsplan wählen
            </a>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-tab-group
          class="analysis-tabs"
          [selectedIndex]="selectedTabIndex()"
          (selectedIndexChange)="onTabIndexChange($event)"
          mat-align-tabs="start"
          data-testid="analysis-tabs"
        >
          <mat-tab data-testid="analysis-tab-overview">
            <ng-template mat-tab-label>
              <mat-icon aria-hidden="true">dashboard</mat-icon>
              <span i18n="@@analysis.tabs.overview">Übersicht</span>
            </ng-template>
            <!--
              matTabContent defers per-tab instantiation until that tab is
              actually selected, so visiting /analysis with N visible
              categories doesn't construct N copies of analysis-group-view
              up front (charts, tables, computeds).
            -->
            <ng-template matTabContent>
              <div class="tab-body">
                <app-analysis-overview
                  (viewSelect)="onOverviewSelect($event)"
                />
              </div>
            </ng-template>
          </mat-tab>
          @for (tab of visibleTabs(); track tab.id) {
            <mat-tab [attr.data-testid]="'analysis-tab-' + tab.id">
              <ng-template mat-tab-label>
                <mat-icon aria-hidden="true">{{ tab.icon }}</mat-icon>
                <span>{{ tab.label }}</span>
              </ng-template>
              <ng-template matTabContent>
                <div class="tab-body">
                  <app-analysis-group-view />
                </div>
              </ng-template>
            </mat-tab>
          }
        </mat-tab-group>
      }
    </main>
  `,
  styles: `
    .page-wrap {
      max-width: 1200px;
      margin: 0 auto;
      padding: 16px;
      display: grid;
      /* minmax(0, 1fr) lets grid children shrink below their intrinsic
         width — without it, mat-tab-header's full row of tab labels
         widens the page past max-width and Material's auto-pagination
         never engages. */
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }

    .filter-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      position: sticky;
      top: calc(var(--top-nav-height, 64px) + var(--desktop-nav-height, 0px));
      z-index: 8;
      margin-inline: -16px;
      padding: 12px 16px;
      background: color-mix(
        in srgb,
        var(--mat-sys-surface, #1e1e1e) 85%,
        transparent
      );
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      -webkit-backdrop-filter: blur(6px);
      backdrop-filter: blur(6px);
    }

    :host-context(html.light-theme) .filter-section {
      background: color-mix(
        in srgb,
        var(--mat-sys-surface, #ffffff) 85%,
        transparent
      );
      border-bottom-color: rgba(148, 163, 184, 0.3);
    }

    @media (max-width: 900px) {
      .page-wrap {
        padding: 12px;
        gap: 12px;
      }
      .filter-section {
        margin-inline: -12px;
        padding: 10px 12px;
      }
    }

    .empty-cta mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .empty-cta > mat-card-content > mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      opacity: 0.7;
    }
    .empty-cta strong {
      display: block;
      margin-bottom: 4px;
    }
    .empty-cta p {
      margin: 0;
      opacity: 0.85;
      max-width: 48ch;
    }
    .empty-cta a {
      margin-left: auto;
    }

    .analysis-tabs {
      width: 100%;
      min-width: 0;
    }
    .analysis-tabs ::ng-deep .mat-mdc-tab-label-container {
      border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    }
    .tab-body {
      display: grid;
      gap: 16px;
      padding: 16px 0;
    }
    @media (max-width: 900px) {
      .tab-body {
        gap: 12px;
        padding: 12px 0;
      }
    }
  `,
})
export class AnalysisPageComponent {
  readonly store = inject(AnalysisStore);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly request = inject(REQUEST, { optional: true }) as {
    url?: string;
  } | null;

  /**
   * Categories that have at least one entry in the active date range.
   * Mirrors `categorySummaries` because both consume the same per-range
   * roll-up, so a card in the overview always matches a tab here.
   */
  readonly visibleTabs = computed<VisibleTab[]>(() =>
    this.store.categorySummaries().map((s) => ({
      id: s.categoryId,
      label: categoryDisplayName(s.categoryId),
      icon: s.icon,
    }))
  );

  /**
   * Overview is index 0; category tabs follow in `visibleTabs` order.
   * When the active view points at a category that isn't visible (e.g.
   * the user narrowed the range past its last entry, or arrived via a
   * stale deep link), we surface the Overview tab rather than leave the
   * group falsely selected — the category will reappear once the range
   * widens again, which also brings its data back.
   */
  readonly selectedTabIndex = computed<number>(() => {
    const view = this.store.activeView();
    if (view === 'overview') return 0;
    const idx = this.visibleTabs().findIndex((t) => t.id === view);
    return idx < 0 ? 0 : idx + 1;
  });

  /**
   * Only reveal the empty-state CTA after the entries resource has resolved.
   * Reading `store.rows()` directly during the initial undefined→[] transition
   * trips Angular's expression-changed-after-checked check in dev mode.
   * Trends use a fixed window independent of the page filter, so the CTA
   * must also stay hidden whenever a trend bucket has activity — otherwise
   * narrowing the filter to an empty range contradicts populated trend cards.
   */
  readonly showEmptyCta = computed(() => {
    if (this.store.entriesResource.status() !== 'resolved') return false;
    if (this.store.weekEntriesResource.status() !== 'resolved') return false;
    if (this.store.monthEntriesResource.status() !== 'resolved') return false;
    if (this.store.unifiedRows().length > 0) return false;
    if (this.store.weekTrend().some((t) => t.total > 0)) return false;
    if (this.store.monthTrend().some((t) => t.total > 0)) return false;
    return true;
  });

  private readonly live = inject(LiveDataStore);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const initial = this.resolveInitialParams();
    this.store.setRange(initial.from, initial.to);
    if (initial.view !== 'overview') {
      this.store.setActiveView(initial.view);
    }

    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      const tick = this.live.updateTick();
      if (!tick) return;
      this.store.refreshAll();
    });

    if (isPlatformBrowser(this.platformId)) {
      const interval = setInterval(() => this.store.tickClock(), 5 * 60 * 1000);
      this.destroyRef.onDestroy(() => clearInterval(interval));
    }

    effect(() => {
      if (!isPlatformBrowser(this.platformId)) return;
      const params = new URLSearchParams();
      const from = this.store.from();
      const to = this.store.to();
      const view = this.store.activeView();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (view !== 'overview') params.set('view', view);

      const query = params.toString();
      const nextUrl = `${this.document.location.pathname}${query ? `?${query}` : ''}`;
      window.history.replaceState(window.history.state, '', nextUrl);
    });
  }

  onTabIndexChange(index: number): void {
    if (index <= 0) {
      this.store.setActiveView('overview');
      return;
    }
    const tab = this.visibleTabs()[index - 1];
    if (!tab) {
      this.store.setActiveView('overview');
      return;
    }
    this.store.setActiveView(tab.id);
  }

  onOverviewSelect(categoryId: ExerciseCategoryId): void {
    this.store.setActiveView(categoryId);
  }

  private resolveInitialParams(): {
    from: string;
    to: string;
    view: AnalysisView;
  } {
    const defaultRange = createWeekRange();
    const search = this.resolveSearchString();
    const params = new URLSearchParams(search);
    const from = params.get('from') ?? defaultRange.from;
    const to = params.get('to') ?? defaultRange.to;
    const viewParam = params.get('view');
    const view: AnalysisView =
      viewParam && VALID_VIEWS.has(viewParam as AnalysisView)
        ? (viewParam as AnalysisView)
        : 'overview';
    return { from, to, view };
  }

  private resolveSearchString(): string {
    if (isPlatformBrowser(this.platformId)) {
      return this.document.location.search || '';
    }

    const url = this.request?.url || '';
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return '';
    return url.slice(qIndex);
  }
}
