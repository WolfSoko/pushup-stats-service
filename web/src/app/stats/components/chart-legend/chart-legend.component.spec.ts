import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import {
  ChartLegendComponent,
  type ChartLegendItem,
} from './chart-legend.component';

@Component({
  selector: 'app-host',
  standalone: true,
  imports: [ChartLegendComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="outer">
    <app-chart-legend
      [items]="items()"
      ariaLabel="Legende"
      testId="legend"
      (itemToggle)="lastToggled.set($event)"
    />
  </div>`,
})
class HostComponent {
  readonly items = signal<ChartLegendItem[]>([
    {
      id: 'reps',
      label: 'Wiederholungen',
      color: '#6b98ff',
      active: true,
      testId: 'legend-reps',
    },
    {
      id: 'avg',
      label: 'Gleitender Durchschnitt',
      color: '#7ef0c8',
      active: false,
      testId: 'legend-avg',
    },
  ]);
  readonly lastToggled = signal<string | null>(null);
}

describe('ChartLegendComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    host = fixture.nativeElement;
  });

  it('should fill the marker of an active series and leave an inactive one hollow', () => {
    // given / when
    const reps = host.querySelector<HTMLElement>('[data-testid="legend-reps"]');
    const avg = host.querySelector<HTMLElement>('[data-testid="legend-avg"]');

    // then
    expect(reps?.getAttribute('aria-checked')).toBe('true');
    expect(reps?.querySelector<HTMLElement>('.dot')?.style.background).toBe(
      'rgb(107, 152, 255)'
    );
    expect(avg?.getAttribute('aria-checked')).toBe('false');
    const avgDot = avg?.querySelector<HTMLElement>('.dot');
    expect(avgDot?.style.background).toBe('transparent');
    expect(avgDot?.style.borderColor).toBe('rgb(126, 240, 200)');
  });

  it('should expose every entry as a switch a keyboard or touch user can operate', () => {
    // given / when
    const buttons = host.querySelectorAll('[data-testid="legend"] button');

    // then
    expect(buttons).toHaveLength(2);
    buttons.forEach((button) =>
      expect(button.getAttribute('role')).toBe('switch')
    );
  });

  it('should emit the clicked item id', () => {
    // given / when
    host
      .querySelector<HTMLButtonElement>('[data-testid="legend-avg"]')
      ?.click();
    fixture.detectChanges();

    // then
    expect(fixture.componentInstance.lastToggled()).toBe('avg');
  });

  it('should not let the click reach an enclosing clickable card', () => {
    // Regression: the dashboard teaser wraps its chart in a card that
    // navigates on click — toggling a series must not also leave the page.
    // given
    let outerClicks = 0;
    host
      .querySelector('.outer')
      ?.addEventListener('click', () => (outerClicks += 1));

    // when
    host
      .querySelector<HTMLButtonElement>('[data-testid="legend-reps"]')
      ?.click();
    fixture.detectChanges();

    // then
    expect(fixture.componentInstance.lastToggled()).toBe('reps');
    expect(outerClicks).toBe(0);
  });
});
