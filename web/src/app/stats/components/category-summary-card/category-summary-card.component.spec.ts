import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';

import type { CategorySummary } from '../../analysis.store';
import { CategorySummaryCardComponent } from './category-summary-card.component';

@Component({
  selector: 'app-host',
  standalone: true,
  imports: [CategorySummaryCardComponent],
  template: `
    <app-category-summary-card
      [summary]="summary()"
      (viewSelect)="lastEmitted.set($event)"
    />
  `,
})
class HostComponent {
  readonly summary = signal<CategorySummary>({
    categoryId: 'pushup',
    nameKey: '@@exercise.category.pushup',
    icon: 'fitness_center',
    order: 10,
    entries: 5,
    currentStreak: 3,
    volume: {
      kind: 'reps',
      totalReps: 123,
      totalSets: 12,
      todayReps: 7,
      bestDay: { date: '2026-02-13', total: 25 },
    },
  });
  readonly lastEmitted = signal<string | null>(null);
}

describe('CategorySummaryCardComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders the localised category name and quick stats for a reps facet', () => {
    const host: HTMLElement = fixture.nativeElement;
    // TestBed default locale is `de` — categoryDisplayName returns the
    // German source string.
    expect(host.textContent).toContain('Liegestütze');
    const totalReps = host.querySelector(
      '[data-testid="category-summary-card-totalReps-pushup"]'
    );
    expect(totalReps?.textContent?.trim()).toBe('123');
  });

  it('renders the bestDay placeholder when no best day is available', () => {
    fixture.componentInstance.summary.set({
      ...fixture.componentInstance.summary(),
      volume: {
        kind: 'reps',
        totalReps: 0,
        totalSets: 0,
        todayReps: 0,
        bestDay: null,
      },
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('—');
  });

  it('emits the categoryId when the details button is clicked', () => {
    const host: HTMLElement = fixture.nativeElement;
    const button = host.querySelector(
      '[data-testid="category-summary-card-drilldown-pushup"]'
    ) as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    expect(fixture.componentInstance.lastEmitted()).toBe('pushup');
  });

  it('carries a category-scoped data-testid so multiple cards stay addressable', () => {
    fixture.componentInstance.summary.set({
      ...fixture.componentInstance.summary(),
      categoryId: 'core',
      icon: 'self_improvement',
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="category-summary-card-core"]')
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="category-summary-card-drilldown-core"]')
    ).toBeTruthy();
  });

  it('reflects the icon prop on the mat-icon avatar', () => {
    const icon = fixture.debugElement.query(By.css('mat-icon'));
    expect(icon.nativeElement.textContent.trim()).toBe('fitness_center');
  });

  it('renders the entry count in the meta row', () => {
    const host: HTMLElement = fixture.nativeElement;
    const entries = host.querySelector(
      '[data-testid="category-summary-card-entries-pushup"]'
    );
    expect(entries?.textContent?.trim()).toBe('5');
  });

  it('renders a time facet as mm:ss instead of reps for time-only categories', () => {
    // Mobility / plank-style category: durations live on durationSec
    // and rendering them as reps would show "0 Reps gesamt" — the
    // bug this redesign exists to fix.
    fixture.componentInstance.summary.set({
      categoryId: 'mobility',
      nameKey: '@@exercise.category.mobility',
      icon: 'accessibility_new',
      order: 90,
      entries: 3,
      currentStreak: 2,
      volume: {
        kind: 'time',
        totalSec: 210,
        todaySec: 120,
        bestDay: { date: '2026-02-15', totalSec: 120 },
      },
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const total = host.querySelector(
      '[data-testid="category-summary-card-totalTime-mobility"]'
    );
    expect(total?.textContent?.trim()).toBe('3:30');
    // No reps slot for a pure-time facet — the reps test-id only
    // exists for the reps facet branch.
    expect(
      host.querySelector(
        '[data-testid="category-summary-card-totalReps-mobility"]'
      )
    ).toBeNull();
    expect(host.textContent).toContain('2:00');
  });

  it('renders a distance-time facet with km, mm:ss and pace for cardio runs', () => {
    fixture.componentInstance.summary.set({
      categoryId: 'cardio',
      nameKey: '@@exercise.category.cardio',
      icon: 'directions_run',
      order: 80,
      entries: 1,
      currentStreak: 1,
      volume: {
        kind: 'distance-time',
        totalM: 5000,
        totalSec: 1500,
        todayM: 0,
        todaySec: 0,
        bestDay: { date: '2026-02-13', totalM: 5000, totalSec: 1500 },
      },
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const total = host.querySelector(
      '[data-testid="category-summary-card-totalDistance-cardio"]'
    );
    expect(total?.textContent?.trim()).toBe('5.00 km');
    expect(host.textContent).toContain('25:00');
    // 1500 s / 5000 m → 5:00 /km pace.
    expect(host.textContent).toContain('5:00 /km');
  });

  it('renders one facet section per measurement for mixed categories (core: reps + time)', () => {
    fixture.componentInstance.summary.set({
      categoryId: 'core',
      nameKey: '@@exercise.category.core',
      icon: 'self_improvement',
      order: 70,
      entries: 3,
      currentStreak: 1,
      volume: {
        kind: 'mixed',
        facets: [
          {
            kind: 'reps',
            totalReps: 30,
            totalSets: 0,
            todayReps: 0,
            bestDay: { date: '2026-02-12', total: 30 },
          },
          {
            kind: 'time',
            totalSec: 210,
            todaySec: 120,
            bestDay: { date: '2026-02-15', totalSec: 120 },
          },
        ],
      },
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector(
        '[data-testid="category-summary-card-facet-reps-core"]'
      )
    ).toBeTruthy();
    expect(
      host.querySelector(
        '[data-testid="category-summary-card-facet-time-core"]'
      )
    ).toBeTruthy();
    // Reps facet renders its number; time facet renders mm:ss alongside.
    expect(host.textContent).toContain('30');
    expect(host.textContent).toContain('3:30');
  });
});
