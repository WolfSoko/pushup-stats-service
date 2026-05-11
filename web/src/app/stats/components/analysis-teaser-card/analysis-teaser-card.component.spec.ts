import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Component, input, signal } from '@angular/core';
import { of } from 'rxjs';
import { AnalysisTeaserCardComponent } from './analysis-teaser-card.component';
import { LiveDataStore, StatsApiService } from '@pu-stats/data-access';
import { AuthStore } from '@pu-auth/auth';
import { makeAuthStoreMock } from '@pu-stats/testing';
import { StatsChartComponent } from '../stats-chart/stats-chart.component';

@Component({
  selector: 'app-stats-chart',
  standalone: true,
  template: '',
})
class StubStatsChartComponent {
  readonly series = input<unknown[]>([]);
  readonly granularity = input<string>('daily');
  readonly rangeMode = input<string>('week');
  readonly from = input<string>('');
  readonly to = input<string>('');
  readonly entries = input<unknown[]>([]);
  readonly kindLabel = input<string>('');
}

function makeLiveStoreMock(
  overrides: {
    connected?: boolean;
    entries?: unknown[];
    exerciseEntries?: unknown[];
  } = {}
) {
  return {
    connected: signal(overrides.connected ?? false),
    entries: signal(overrides.entries ?? []),
    exerciseEntries: signal(overrides.exerciseEntries ?? []),
    updateTick: signal(0),
  };
}

describe('AnalysisTeaserCardComponent', () => {
  let fixture: ComponentFixture<AnalysisTeaserCardComponent>;
  let component: AnalysisTeaserCardComponent;
  let routerSpy: { navigate: ReturnType<typeof vitest.fn> };

  const apiMock = {
    load: vitest.fn().mockReturnValue(
      of({
        meta: {
          from: null,
          to: null,
          entries: 5,
          days: 5,
          total: 100,
          granularity: 'daily',
        },
        series: [{ bucket: '2026-03-30', total: 20, dayIntegral: 20 }],
      })
    ),
  };

  async function setupWithLiveStore(
    liveStoreOverrides: Parameters<typeof makeLiveStoreMock>[0] = {}
  ) {
    routerSpy = { navigate: vitest.fn() };

    await TestBed.configureTestingModule({
      imports: [AnalysisTeaserCardComponent],
      providers: [
        { provide: StatsApiService, useValue: apiMock },
        { provide: Router, useValue: routerSpy },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
        {
          provide: LiveDataStore,
          useValue: makeLiveStoreMock(liveStoreOverrides),
        },
      ],
    })
      .overrideComponent(AnalysisTeaserCardComponent, {
        remove: { imports: [StatsChartComponent] },
        add: { imports: [StubStatsChartComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AnalysisTeaserCardComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  }

  beforeEach(async () => {
    vitest.clearAllMocks();
    await setupWithLiveStore();
  });

  describe('Given the component is rendered', () => {
    describe('When navigateToAnalysis is called', () => {
      it('Then it should navigate to /analysis', () => {
        // When
        component.navigateToAnalysis();

        // Then
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/analysis']);
      });
    });

    describe('When enter key is pressed on the card', () => {
      it('Then it should navigate to /analysis', () => {
        // Given
        fixture.detectChanges();
        const card = fixture.nativeElement.querySelector('mat-card');

        // When
        card.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );

        // Then
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/analysis']);
      });
    });

    describe('When space key is pressed on the card', () => {
      it('Then it should navigate to /analysis', () => {
        // Given
        fixture.detectChanges();
        const card = fixture.nativeElement.querySelector('mat-card');

        // When
        card.dispatchEvent(
          new KeyboardEvent('keyup', { key: ' ', bubbles: true })
        );

        // Then
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/analysis']);
      });
    });

    describe('When the card is clicked', () => {
      it('Then it should navigate to /analysis', () => {
        // Given
        fixture.detectChanges();
        const card = fixture.nativeElement.querySelector('mat-card');

        // When
        card.click();

        // Then
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/analysis']);
      });
    });
  });

  describe('Given the component has accessibility attributes', () => {
    it('Then the card should have role="link"', () => {
      // Given
      fixture.detectChanges();

      // When
      const card = fixture.nativeElement.querySelector('mat-card');

      // Then
      expect(card.getAttribute('role')).toBe('link');
    });

    it('Then the card should have tabindex="0"', () => {
      // Given
      fixture.detectChanges();

      // When
      const card = fixture.nativeElement.querySelector('mat-card');

      // Then
      expect(card.getAttribute('tabindex')).toBe('0');
    });

    it('Then the card should have an aria-label', () => {
      // Given
      fixture.detectChanges();

      // When
      const card = fixture.nativeElement.querySelector('mat-card');

      // Then
      expect(card.getAttribute('aria-label')).toBeTruthy();
    });
  });

  describe('Given the API returns data successfully', () => {
    it('Then it should display the chart', async () => {
      // Given
      await fixture.whenStable();
      fixture.detectChanges();

      // When
      const chart = fixture.nativeElement.querySelector('app-stats-chart');

      // Then
      expect(chart).toBeTruthy();
    });

    it('Then chartSeries should contain the loaded data', async () => {
      // Given / When
      fixture.detectChanges();
      await fixture.whenStable();

      // Then
      expect(component.chartSeries().length).toBeGreaterThan(0);
    });
  });

  describe('Given the mini-chart container sizing', () => {
    it('Then .mini-chart should be rendered when data loads', async () => {
      // Given
      await fixture.whenStable();
      fixture.detectChanges();

      // When
      const miniChart: HTMLElement =
        fixture.nativeElement.querySelector('.mini-chart');

      // Then
      expect(miniChart).toBeTruthy();
    });

    it('Then .mini-chart height must use responsive clamp, not a fixed 180px', () => {
      // Regression guard: the old 180px height cut off the chart.
      // We verify the component's compiled styles contain the correct clamp().
      const cmpDef = (AnalysisTeaserCardComponent as any).ɵcmp;
      const allStyles: string[] = cmpDef?.styles ?? [];
      const joined = allStyles.join(' ');

      // The compiled styles must reference the responsive height
      expect(joined).toContain('clamp(260px');
      // Must NOT contain the old fixed 180px for mini-chart
      expect(joined).not.toMatch(/\.mini-chart[^}]*height:\s*180px/);
    });
  });

  describe('Given the week range computation', () => {
    it('Then from should be a Monday date string', () => {
      // Given / When
      const dateStr = component.from();

      // Then
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const [y, m, d] = dateStr.split('-').map(Number);
      // getUTCDay() returns 1 for Monday
      expect(new Date(Date.UTC(y, m - 1, d)).getUTCDay()).toBe(1);
    });

    it('Then to should be a Sunday date string', () => {
      // Given / When
      const dateStr = component.to();

      // Then
      expect(dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const [y, m, d] = dateStr.split('-').map(Number);
      // getUTCDay() returns 0 for Sunday
      expect(new Date(Date.UTC(y, m - 1, d)).getUTCDay()).toBe(0);
    });
  });

  describe('Given the chart heading', () => {
    it('Then chartKindLabel is set so the chart can name its exercises', () => {
      expect(component.chartKindLabel).toBeTruthy();
      expect(typeof component.chartKindLabel).toBe('string');
    });

    it('Then the kindLabel is forwarded to the stats chart', () => {
      fixture.detectChanges();
      const chart = fixture.debugElement.query(
        By.directive(StubStatsChartComponent)
      );
      const stub = chart?.componentInstance as
        | StubStatsChartComponent
        | undefined;
      expect(stub?.kindLabel()).toBe(component.chartKindLabel);
    });
  });

  describe('Given the live store has not connected yet', () => {
    it('Then chartSeries falls back to the REST resource (pushup-only)', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      // REST mock returns one bucket; live store is disconnected.
      expect(component.chartSeries()).toEqual([
        { bucket: '2026-03-30', total: 20, dayIntegral: 20 },
      ]);
    });
  });

  describe('Given the live store has connected with unified entries', () => {
    let liveFixture: ComponentFixture<AnalysisTeaserCardComponent>;
    let liveComponent: AnalysisTeaserCardComponent;

    function freshMonday(): { weekStart: string; weekMid: string } {
      const today = new Date();
      const dayOfWeek = (today.getDay() + 6) % 7;
      const monday = new Date(today);
      monday.setDate(today.getDate() - dayOfWeek);
      const wednesday = new Date(monday);
      wednesday.setDate(monday.getDate() + 2);
      const pad = (n: number) => String(n).padStart(2, '0');
      const fmt = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { weekStart: fmt(monday), weekMid: fmt(wednesday) };
    }

    beforeEach(async () => {
      const { weekStart, weekMid } = freshMonday();
      TestBed.resetTestingModule();
      await setupWithLiveStore({
        connected: true,
        entries: [
          { _id: 'p1', timestamp: `${weekStart}T08:00:00+01:00`, reps: 10 },
        ],
        exerciseEntries: [
          {
            _id: 'e1',
            exerciseId: 'abs.situps',
            timestamp: `${weekMid}T12:00:00+01:00`,
            reps: 15,
            source: 'web',
          },
          {
            _id: 'e2',
            exerciseId: 'plank.standard',
            timestamp: `${weekMid}T13:00:00+01:00`,
            durationSec: 60,
            source: 'web',
          },
        ],
      });
      liveFixture = fixture;
      liveComponent = component;
      liveFixture.detectChanges();
      await liveFixture.whenStable();
    });

    it('Then chartSeries combines pushups and exercise reps per day', () => {
      const series = liveComponent.chartSeries();
      const { weekStart, weekMid } = freshMonday();

      // Pushups on Monday: 10 reps
      // Situps on Wednesday: 15 reps (plank has no reps → excluded)
      const monday = series.find((s) => s.bucket === weekStart);
      const wednesday = series.find((s) => s.bucket === weekMid);
      expect(monday?.total).toBe(10);
      expect(wednesday?.total).toBe(15);
    });

    it('Then dayIntegral is cumulative across the merged days', () => {
      const series = liveComponent.chartSeries();
      // 10 on Monday, +15 on Wednesday → 25 cumulative on Wednesday
      const cumulativeTotals = series.map((s) => s.dayIntegral);
      expect(cumulativeTotals[cumulativeTotals.length - 1]).toBe(25);
    });

    it('Then entries outside the week range are excluded', async () => {
      TestBed.resetTestingModule();
      await setupWithLiveStore({
        connected: true,
        entries: [
          { _id: 'p-old', timestamp: '2020-01-01T08:00:00+01:00', reps: 999 },
        ],
        exerciseEntries: [],
      });
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.chartSeries()).toEqual([]);
    });
  });
});
