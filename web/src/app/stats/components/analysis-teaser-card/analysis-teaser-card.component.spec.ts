import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Component, input } from '@angular/core';
import { of } from 'rxjs';
import { AnalysisTeaserCardComponent } from './analysis-teaser-card.component';
import { StatsApiService } from '@pu-stats/data-access';
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

  beforeEach(async () => {
    vitest.clearAllMocks();
    routerSpy = { navigate: vitest.fn() };

    await TestBed.configureTestingModule({
      imports: [AnalysisTeaserCardComponent],
      providers: [
        { provide: StatsApiService, useValue: apiMock },
        { provide: Router, useValue: routerSpy },
        { provide: AuthStore, useValue: makeAuthStoreMock() },
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
          new KeyboardEvent('keydown', { key: ' ', bubbles: true })
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
      await fixture.whenStable();

      // Then
      expect(component.chartSeries().length).toBeGreaterThan(0);
    });
  });

  describe('Given the week range computation', () => {
    it('Then from should be a Monday date string', () => {
      // Given / When
      const from = component.from();

      // Then
      expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const date = new Date(from);
      // getDay() returns 1 for Monday
      expect(date.getDay()).toBe(1);
    });

    it('Then to should be a Sunday date string', () => {
      // Given / When
      const to = component.to();

      // Then
      expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const date = new Date(to);
      // getDay() returns 0 for Sunday
      expect(date.getDay()).toBe(0);
    });
  });
});
