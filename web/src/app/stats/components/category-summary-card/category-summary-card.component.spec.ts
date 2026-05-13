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
    categoryId: 'push',
    nameKey: '@@exercise.category.push',
    icon: 'fitness_center',
    order: 10,
    totalReps: 123,
    totalSets: 12,
    todayReps: 7,
    currentStreak: 3,
    bestDay: { date: '2026-02-13', total: 25 },
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

  it('renders the localised category name and quick stats', () => {
    const host: HTMLElement = fixture.nativeElement;
    // TestBed default locale is `de` — categoryDisplayName returns the
    // German source string.
    expect(host.textContent).toContain('Drücken');
    const totalReps = host.querySelector(
      '[data-testid="category-summary-card-totalReps-push"]'
    );
    expect(totalReps?.textContent?.trim()).toBe('123');
  });

  it('renders the bestDay placeholder when no best day is available', () => {
    fixture.componentInstance.summary.set({
      ...fixture.componentInstance.summary(),
      bestDay: null,
    });
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('—');
  });

  it('emits the categoryId when the details button is clicked', () => {
    const host: HTMLElement = fixture.nativeElement;
    const button = host.querySelector(
      '[data-testid="category-summary-card-drilldown-push"]'
    ) as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    expect(fixture.componentInstance.lastEmitted()).toBe('push');
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
});
