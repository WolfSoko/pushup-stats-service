import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StatsTableComponent } from './stats-table.component';

describe('StatsTableComponent', () => {
  let fixture: ComponentFixture<StatsTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsTableComponent);
  });

  it('renders daily bucket using date pipe format', () => {
    fixture.componentRef.setInput('granularity', 'daily');
    fixture.componentRef.setInput('rows', [{ bucket: '2026-02-10', total: 10, dayIntegral: 10 }]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('10.02.2026');
  });

  it('renders hourly bucket including minute precision', () => {
    fixture.componentRef.setInput('granularity', 'hourly');
    fixture.componentRef.setInput('rows', [{ bucket: '2026-02-10T13:45', total: 8, dayIntegral: 18 }]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('10.02., 13:45');
  });
});
