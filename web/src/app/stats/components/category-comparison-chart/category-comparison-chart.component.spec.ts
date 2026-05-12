import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonToggleHarness } from '@angular/material/button-toggle/testing';
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
    reps: [],
    sets: [],
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
    fixture.componentInstance.data.set({ labels: [], reps: [], sets: [] });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(
      host.querySelector('[data-testid="category-comparison-empty"]')
    ).toBeTruthy();
    expect(
      host.querySelector('[data-testid="category-comparison-bars"]')
    ).toBeNull();
  });

  it('renders one bar per category with reps as the default metric', () => {
    fixture.componentInstance.data.set({
      labels: ['Pushups', 'Abs', 'Legs'],
      reps: [100, 50, 25],
      sets: [10, 5, 2],
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const rows = host.querySelectorAll('.bar-row');
    expect(rows).toHaveLength(3);

    const labels = Array.from(host.querySelectorAll('.bar-label')).map((el) =>
      el.textContent?.trim()
    );
    expect(labels).toEqual(['Pushups', 'Abs', 'Legs']);

    // First row carries the max — fill is 100%.
    const firstFill = host.querySelector('.bar-row .bar-fill') as HTMLElement;
    expect(firstFill.style.width).toBe('100%');
  });

  it('switching to sets scales the bars by sets and updates the displayed value', async () => {
    fixture.componentInstance.data.set({
      labels: ['Pushups', 'Abs'],
      reps: [100, 50],
      sets: [10, 40],
    });
    fixture.detectChanges();

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const toggles = await loader.getAllHarnesses(MatButtonToggleHarness);
    // `Array.prototype.find` with an async predicate is a footgun — the
    // predicate always returns a truthy Promise, so the first toggle
    // wins regardless of its label. Resolve labels first and match by
    // value.
    const labels = await Promise.all(toggles.map((t) => t.getText()));
    const setsIdx = labels.findIndex((l) => l.trim() === 'Sätze');
    expect(setsIdx).toBeGreaterThanOrEqual(0);
    await toggles[setsIdx].toggle();
    fixture.detectChanges();

    const host: HTMLElement = fixture.nativeElement;
    const values = Array.from(host.querySelectorAll('.bar-value')).map((el) =>
      el.textContent?.trim()
    );
    expect(values).toEqual(['10', '40']);
    // Max is now Abs (40), so its bar fills the full track.
    const fills = host.querySelectorAll('.bar-fill');
    expect((fills[0] as HTMLElement).style.width).toBe('25%');
    expect((fills[1] as HTMLElement).style.width).toBe('100%');
  });

  it('renders zero-width fills without dividing by zero when every value is zero', () => {
    fixture.componentInstance.data.set({
      labels: ['Pushups'],
      reps: [0],
      sets: [0],
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    const fill = host.querySelector('.bar-fill') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });
});
