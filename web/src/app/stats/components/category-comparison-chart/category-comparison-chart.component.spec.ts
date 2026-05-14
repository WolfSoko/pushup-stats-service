import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';

import type { CategoryComparison } from '../../analysis.store';
import { CategoryComparisonChartComponent } from './category-comparison-chart.component';

@Component({
  selector: 'app-host',
  standalone: true,
  imports: [CategoryComparisonChartComponent],
  template: `<app-category-comparison-chart [data]="data()" />`,
})
class HostComponent {
  readonly data = signal<CategoryComparison>({
    labels: [],
    entries: [],
  });
}

describe('CategoryComparisonChartComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
  });

  it('renders the empty state when there are no categories', () => {
    fixture.componentInstance.data.set({ labels: [], entries: [] });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="category-comparison-empty"]')
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="category-comparison-bars"]')
    ).toBeNull();
  });

  it('renders one bar per category sized by training count', () => {
    // Bar metric is intentionally a count of trainings — reps,
    // seconds and meters live on different scales, so the redesign
    // dropped the reps/sets toggle in favour of a single measurement-
    // agnostic axis.
    fixture.componentInstance.data.set({
      labels: ['Pushups', 'Abs', 'Cardio'],
      entries: [12, 4, 2],
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const rows = host.querySelectorAll('.bar-row');
    expect(rows).toHaveLength(3);

    const labels = Array.from(host.querySelectorAll('.bar-label')).map((el) =>
      el.textContent?.trim()
    );
    expect(labels).toEqual(['Pushups', 'Abs', 'Cardio']);

    const fills = Array.from(
      host.querySelectorAll('.bar-fill')
    ) as HTMLElement[];
    expect(fills[0].style.width).toBe('100%');
    expect(fills[1].style.width).toBe(`${(4 / 12) * 100}%`);
    expect(fills[2].style.width).toBe(`${(2 / 12) * 100}%`);

    const values = Array.from(host.querySelectorAll('.bar-value')).map((el) =>
      el.textContent?.trim()
    );
    expect(values).toEqual(['12', '4', '2']);
  });

  it('renders zero-width fills without dividing by zero when every value is zero', () => {
    fixture.componentInstance.data.set({
      labels: ['Pushups'],
      entries: [0],
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const fill = host.querySelector('.bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('shows the metric label so users can read the axis without a legend', () => {
    fixture.componentInstance.data.set({
      labels: ['Pushups'],
      entries: [3],
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    // German source locale.
    expect(host.textContent).toContain('Trainingseinheiten');
  });
});
