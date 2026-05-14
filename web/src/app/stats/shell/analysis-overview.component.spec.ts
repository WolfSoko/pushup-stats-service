import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { CategoryComparison, CategorySummary } from '../analysis.store';
import { AnalysisStore } from '../analysis.store';

type AnalysisStoreType = InstanceType<typeof AnalysisStore>;
import { AnalysisOverviewComponent } from './analysis-overview.component';
import { AnalysisGroupViewComponent } from './analysis-group-view.component';
import { CategoryComparisonChartComponent } from '../components/category-comparison-chart/category-comparison-chart.component';
import { CategorySummaryCardComponent } from '../components/category-summary-card/category-summary-card.component';

// Replace the heavy real children with no-op stubs so the spec stays
// focused on the overview component's own branching/wiring (empty-state,
// uncategorised fallback, viewSelect forward).
@Component({
  selector: 'app-category-comparison-chart',
  standalone: true,
  template: '',
})
class StubComparisonChartComponent {
  // Mirror the real component's signal input surface so the overview's
  // `[data]="..."` binding type-checks against the stub.
  readonly data = input<CategoryComparison>({ labels: [], entries: [] });
}

@Component({
  selector: 'app-category-summary-card',
  standalone: true,
  template: '<button type="button" (click)="emit()">drill</button>',
})
class StubSummaryCardComponent {
  readonly summary = input.required<CategorySummary>();
  readonly viewSelect = output<string>();
  emit(): void {
    this.viewSelect.emit(this.summary().categoryId);
  }
}

@Component({
  selector: 'app-analysis-group-view',
  standalone: true,
  template: '<div data-testid="stub-group-view"></div>',
})
class StubAnalysisGroupViewComponent {}

interface FakeStore {
  categorySummaries: ReturnType<typeof signal<CategorySummary[]>>;
  categoryComparison: ReturnType<typeof signal<CategoryComparison>>;
  unifiedRows: ReturnType<typeof signal<unknown[]>>;
  activeView: ReturnType<typeof signal<string>>;
  setActiveView: (view: string) => void;
}

function makeFakeStore(): FakeStore {
  const activeView = signal<string>('overview');
  return {
    categorySummaries: signal<CategorySummary[]>([]),
    categoryComparison: signal<CategoryComparison>({
      labels: [],
      entries: [],
    }),
    unifiedRows: signal<unknown[]>([]),
    activeView,
    setActiveView: (view: string) => activeView.set(view),
  };
}

@Component({
  selector: 'app-host',
  standalone: true,
  imports: [AnalysisOverviewComponent],
  template: `<app-analysis-overview (viewSelect)="lastEmitted.set($event)" />`,
})
class HostComponent {
  readonly lastEmitted = signal<string | null>(null);
}

describe('AnalysisOverviewComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let store: FakeStore;

  beforeEach(async () => {
    store = makeFakeStore();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: AnalysisStore,
          useValue: store as unknown as AnalysisStoreType,
        },
      ],
    })
      .overrideComponent(AnalysisOverviewComponent, {
        remove: {
          imports: [
            CategoryComparisonChartComponent,
            CategorySummaryCardComponent,
            AnalysisGroupViewComponent,
          ],
        },
        add: {
          imports: [
            StubComparisonChartComponent,
            StubSummaryCardComponent,
            StubAnalysisGroupViewComponent,
          ],
        },
      })
      .compileComponents();
    fixture = TestBed.createComponent(HostComponent);
  });

  it('renders the empty state when there are no rows and no categories', () => {
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="analysis-overview-empty"]')
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="analysis-overview-cards"]')
    ).toBeNull();
    expect(host.querySelector('[data-testid="stub-group-view"]')).toBeNull();
  });

  it('falls back to the group-view when rows exist but no category mapped', () => {
    // Plan requirement: entries whose `exerciseId` is missing from the
    // catalog (so `categorySummaries` skips them) must still surface in
    // the Overview tab. The dedicated notice + group-view render in
    // place of the "no entries" message.
    store.unifiedRows.set([{ id: 'orphan' }]);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('[data-testid="stub-group-view"]')).toBeTruthy();
    expect(
      host.querySelector(
        '[data-testid="analysis-overview-uncategorised-notice"]'
      )
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="analysis-overview-empty"]')
    ).toBeNull();
  });

  it('renders the chart and one card per summary when categories exist', () => {
    store.categorySummaries.set([
      {
        categoryId: 'pushup',
        nameKey: '@@exercise.category.pushup',
        icon: 'fitness_center',
        order: 10,
        entries: 5,
        currentStreak: 3,
        volume: {
          kind: 'reps',
          totalReps: 100,
          totalSets: 12,
          todayReps: 7,
          bestDay: { date: '2026-02-13', total: 25 },
        },
      },
      {
        categoryId: 'core',
        nameKey: '@@exercise.category.core',
        icon: 'self_improvement',
        order: 20,
        entries: 2,
        currentStreak: 1,
        volume: {
          kind: 'reps',
          totalReps: 30,
          totalSets: 0,
          todayReps: 0,
          bestDay: { date: '2026-02-12', total: 30 },
        },
      },
    ]);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="analysis-overview-cards"]')
    ).toBeTruthy();
    expect(host.querySelectorAll('app-category-summary-card')).toHaveLength(2);
    expect(host.querySelector('app-category-comparison-chart')).toBeTruthy();
    expect(
      host.querySelector('[data-testid="analysis-overview-empty"]')
    ).toBeNull();
  });

  it('prefers the category overview over the uncategorised fallback when both signals are populated', () => {
    // Precedence regression guard: if a future refactor swaps the order
    // of the `@if` / `@else if` branches in the template, this test
    // would catch the regression. The Overview must show the
    // comparison + cards (not the uncategorised notice) whenever any
    // category roll-up exists, regardless of whether unifiedRows also
    // carries rows.
    store.categorySummaries.set([
      {
        categoryId: 'pushup',
        nameKey: '@@exercise.category.pushup',
        icon: 'fitness_center',
        order: 10,
        entries: 5,
        currentStreak: 3,
        volume: {
          kind: 'reps',
          totalReps: 100,
          totalSets: 12,
          todayReps: 7,
          bestDay: { date: '2026-02-13', total: 25 },
        },
      },
    ]);
    store.unifiedRows.set([{ id: 'orphan' }]);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="analysis-overview-cards"]')
    ).toBeTruthy();
    expect(host.querySelectorAll('app-category-summary-card')).toHaveLength(1);
    expect(host.querySelector('app-category-comparison-chart')).toBeTruthy();
    expect(host.querySelector('[data-testid="stub-group-view"]')).toBeNull();
    expect(
      host.querySelector(
        '[data-testid="analysis-overview-uncategorised-notice"]'
      )
    ).toBeNull();
    expect(
      host.querySelector('[data-testid="analysis-overview-empty"]')
    ).toBeNull();
  });

  it('forwards viewSelect emissions from a summary card up to the parent', () => {
    store.categorySummaries.set([
      {
        categoryId: 'pushup',
        nameKey: '@@exercise.category.pushup',
        icon: 'fitness_center',
        order: 10,
        entries: 5,
        currentStreak: 3,
        volume: {
          kind: 'reps',
          totalReps: 100,
          totalSets: 12,
          todayReps: 7,
          bestDay: null,
        },
      },
    ]);
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const button = host.querySelector(
      'app-category-summary-card button'
    ) as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.lastEmitted()).toBe('pushup');
  });

  it('snaps activeView to overview in the uncategorised fallback so the embedded group-view is not stale-filtered', () => {
    // Regression for Copilot finding: a stale `?view=plank` deep link
    // leaves `activeView` pointing at an empty category. The embedded
    // `<app-analysis-group-view />` then reads `viewFilteredRows()`
    // scoped to plank → empty subset, defeating the fallback's whole
    // point of surfacing the uncategorised rows. The component's
    // effect must re-sync activeView to 'overview' as soon as it
    // enters the fallback branch.
    store.activeView.set('mobility');
    store.unifiedRows.set([{ id: 'orphan' }]);
    fixture.detectChanges();
    expect(store.activeView()).toBe('overview');
  });

  it('leaves activeView alone when the category overview branch is active', () => {
    // Guard against the snap firing too eagerly: when category data
    // exists, the user may have legitimately landed via `?view=plank`
    // and is currently looking at the overview tab only because the
    // shell rendered it as the default Overview view. Snapping then
    // would corrupt the deep-link intent.
    store.activeView.set('mobility');
    store.categorySummaries.set([
      {
        categoryId: 'pushup',
        nameKey: '@@exercise.category.pushup',
        icon: 'fitness_center',
        order: 10,
        entries: 5,
        currentStreak: 3,
        volume: {
          kind: 'reps',
          totalReps: 100,
          totalSets: 12,
          todayReps: 7,
          bestDay: null,
        },
      },
    ]);
    fixture.detectChanges();
    expect(store.activeView()).toBe('mobility');
  });
});
