import { By } from '@angular/platform-browser';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { provideRouter } from '@angular/router';
import { EMPTY_TRAINING_SUMMARY, type TrainingSummary } from '@pu-stats/models';

import { AllTimeBadgesComponent } from './all-time-badges.component';

const SUMMARY: TrainingSummary = {
  ...EMPTY_TRAINING_SUMMARY,
  reps: 1200,
  durationSec: 5400,
  distanceM: 42000,
  days: 30,
  entries: 90,
};

describe('AllTimeBadgesComponent', () => {
  async function render(summary = SUMMARY, loading = false) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AllTimeBadgesComponent],
      providers: [provideRouter([]), { provide: LOCALE_ID, useValue: 'en-US' }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AllTimeBadgesComponent);
    fixture.componentRef.setInput('summary', summary);
    fixture.componentRef.setInput('loading', loading);
    fixture.detectChanges();
    return fixture;
  }

  function text(
    fixture: Awaited<ReturnType<typeof render>>,
    testId: string
  ): string | undefined {
    return fixture.nativeElement
      .querySelector(`[data-testid="${testId}"]`)
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();
  }

  it('should say that the numbers cover every exercise', async () => {
    // when
    const fixture = await render();

    // then
    expect(fixture.nativeElement.textContent).toContain(
      'Alle Übungen seit Beginn'
    );
  });

  it('should render each volume in its own unit', async () => {
    // when
    const fixture = await render();

    // then
    expect(text(fixture, 'all-time-reps')).toContain('1,200');
    expect(text(fixture, 'all-time-duration')).toContain('1 h 30 min');
    expect(text(fixture, 'all-time-distance')).toContain('42.0 km');
    expect(text(fixture, 'all-time-days')).toContain('30');
    expect(text(fixture, 'all-time-entries')).toContain('90');
  });

  it('should leave out time and distance nobody logged', async () => {
    // given — a pure push-up user would otherwise read "0 min"
    const summary = { ...SUMMARY, durationSec: 0, distanceM: 0 };

    // when
    const fixture = await render(summary);

    // then
    expect(text(fixture, 'all-time-duration')).toBeUndefined();
    expect(text(fixture, 'all-time-distance')).toBeUndefined();
    expect(text(fixture, 'all-time-reps')).toBeDefined();
  });

  it('should explain every badge in its tooltip and to a screen reader', async () => {
    // when
    const fixture = await render();

    // then
    const tooltips = fixture.debugElement
      .queryAll(By.directive(MatTooltip))
      .map((el) => el.injector.get(MatTooltip).message);
    const labels = [...fixture.nativeElement.querySelectorAll('.badge')].map(
      (el: Element) => el.getAttribute('aria-label')
    );
    expect(tooltips).toHaveLength(5);
    expect(labels).toEqual(tooltips);
    for (const message of tooltips) expect(message).not.toBe('');
  });

  it('should show a skeleton per value while the entries are still loading', async () => {
    // when
    const fixture = await render(SUMMARY, true);

    // then
    expect(fixture.nativeElement.querySelectorAll('pu-skeleton')).toHaveLength(
      3
    );
    expect(text(fixture, 'all-time-duration')).toBeUndefined();
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="dashboard-all-time-badges-link"]')
        .getAttribute('aria-busy')
    ).toBe('true');
  });

  it('should still link to the analysis page', async () => {
    // when
    const fixture = await render();

    // then
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="dashboard-all-time-badges-link"]')
        .getAttribute('href')
    ).toBe('/analysis');
  });
});
