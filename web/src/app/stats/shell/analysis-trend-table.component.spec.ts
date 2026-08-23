import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import type { TrendPoint } from '../analysis/analysis.types';
import type { SegmentMeasurement } from '../analysis/measurement-groups';
import { AnalysisTrendTableComponent } from './analysis-trend-table.component';

const rows: TrendPoint[] = [
  { label: '2026-W07', total: 90, avgSetsPerEntry: 2 },
  { label: '2026-W06', total: 0 },
];

async function render(
  measurement: SegmentMeasurement,
  showSets: boolean
): Promise<ComponentFixture<AnalysisTrendTableComponent>> {
  await TestBed.configureTestingModule({
    imports: [AnalysisTrendTableComponent],
    providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
  }).compileComponents();

  const fixture = TestBed.createComponent(AnalysisTrendTableComponent);
  fixture.componentRef.setInput('rows', rows);
  fixture.componentRef.setInput('measurement', measurement);
  fixture.componentRef.setInput('valueLabel', 'Dauer');
  fixture.componentRef.setInput('title', 'Wochentrend');
  fixture.componentRef.setInput('subtitle', 'Letzte 8 Wochen');
  fixture.componentRef.setInput('periodLabel', 'Woche');
  fixture.componentRef.setInput('showSets', showSets);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('AnalysisTrendTableComponent', () => {
  it('should render the dimension name as the card header copy', async () => {
    // given / when
    const fixture = await render('time', false);

    // then
    const host: HTMLElement = fixture.nativeElement;
    expect(host.textContent).toContain('Wochentrend');
    expect(host.textContent).toContain('Letzte 8 Wochen');
  });

  it('should format cells in the block’s own unit', async () => {
    // given / when
    const fixture = await render('time', false);

    // then — 90 s reads as 1:30, not as a bare rep count
    expect(fixture.componentInstance.formatValue(90)).toBe('1:30');
  });

  it('should leave the reps unit to the column header instead of every cell', async () => {
    // given / when
    const fixture = await render('reps', true);

    // then
    expect(fixture.componentInstance.formatValue(42)).toBe('42');
  });

  it('should drop the sets column for measurements that cannot log sets', async () => {
    // given / when
    const fixture = await render('time', false);

    // then
    expect(fixture.componentInstance.columns()).toEqual(['label', 'total']);
  });

  it('should keep the sets column for rep-measured blocks', async () => {
    // given / when
    const fixture = await render('reps', true);

    // then
    expect(fixture.componentInstance.columns()).toEqual([
      'label',
      'total',
      'avgSetsPerEntry',
    ]);
  });
});
