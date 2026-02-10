import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatsTableComponent } from './stats-table.component';

describe('StatsTableComponent', () => {
  let fixture: ComponentFixture<StatsTableComponent>;
  let component: StatsTableComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsTableComponent);
    component = fixture.componentInstance;
  });

  it('formats daily bucket as german date', () => {
    fixture.componentRef.setInput('granularity', 'daily');
    fixture.detectChanges();

    expect(component.formatBucket('2026-02-10')).toBe('10.2.2026');
  });

  it('formats hourly bucket with date and time', () => {
    fixture.componentRef.setInput('granularity', 'hourly');
    fixture.detectChanges();

    const formatted = component.formatBucket('2026-02-10T13');
    expect(formatted).toContain('10.02.');
    expect(formatted).toContain('13:00');
  });
});
