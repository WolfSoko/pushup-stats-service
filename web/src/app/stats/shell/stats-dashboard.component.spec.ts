import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StatsDashboardComponent } from './stats-dashboard.component';
import { StatsApiService } from '@nx-temp/stats-data-access';

describe('StatsDashboardComponent', () => {
  let fixture: ComponentFixture<StatsDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsDashboardComponent],
      providers: [
        {
          provide: StatsApiService,
          useValue: {
            load: jest.fn().mockReturnValue(
              of({
                meta: {
                  from: null,
                  to: null,
                  entries: 2,
                  days: 1,
                  total: 50,
                  granularity: 'daily',
                },
                series: [{ bucket: '2026-01-10', total: 50, dayIntegral: 50 }],
              }),
            ),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows german title and total kpi', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Liegestütze Statistik');
    expect(text).toContain('50');
  });
});
