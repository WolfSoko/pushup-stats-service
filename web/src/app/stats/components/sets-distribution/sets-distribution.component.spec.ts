import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  SetsDistributionComponent,
  SetsDistributionDatum,
} from './sets-distribution.component';

describe('SetsDistributionComponent', () => {
  let fixture: ComponentFixture<SetsDistributionComponent>;
  let component: SetsDistributionComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetsDistributionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SetsDistributionComponent);
    component = fixture.componentInstance;
  });

  it('renders empty message when no data', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.empty')).toBeTruthy();
    expect(el.querySelector('.bars')).toBeNull();
  });

  it('renders bars when data is present', () => {
    const data: SetsDistributionDatum[] = [
      { setCount: 2, count: 3, percent: 60 },
      { setCount: 3, count: 2, percent: 40 },
    ];
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.bars')).toBeTruthy();
    expect(el.querySelectorAll('.bar-row').length).toBe(2);
  });

  it('scales bar width relative to max percent', () => {
    const data: SetsDistributionDatum[] = [
      { setCount: 2, count: 6, percent: 60 },
      { setCount: 3, count: 4, percent: 40 },
    ];
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();

    // 60% is max → bar width should be 100%
    expect(component.barWidth(60)).toBe(100);
    // 40% → bar width ≈ 66.67%
    expect(component.barWidth(40)).toBeCloseTo(66.67, 0);
  });
});
