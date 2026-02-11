import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StatsDashboardComponent } from './stats-dashboard.component';
import { StatsApiService } from '@nx-temp/stats-data-access';

describe('StatsDashboardComponent', () => {
  let fixture: ComponentFixture<StatsDashboardComponent>;
  const serviceMock = {
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
  };

  beforeEach(async () => {
    serviceMock.load.mockClear();
    window.history.replaceState({}, '', '/?from=2026-02-01&to=2026-02-10');

    await TestBed.configureTestingModule({
      imports: [StatsDashboardComponent],
      providers: [
        {
          provide: StatsApiService,
          useValue: serviceMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsDashboardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('shows german title and total kpi', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Liegestütze Statistik');
    expect(text).toContain('50');
  });

  it('initializes filter state from URL query params', () => {
    const component = fixture.componentInstance;
    expect(component.from()).toBe('2026-02-01');
    expect(component.to()).toBe('2026-02-10');
    expect(serviceMock.load).toHaveBeenCalledWith({ from: '2026-02-01', to: '2026-02-10' });
  });

  it('falls back to default range when URL has no filter params', async () => {
    window.history.replaceState({}, '', '/');
    serviceMock.load.mockClear();

    const localFixture = TestBed.createComponent(StatsDashboardComponent);
    localFixture.detectChanges();
    await localFixture.whenStable();

    const component = localFixture.componentInstance;
    expect(component.from()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(component.to()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(serviceMock.load).toHaveBeenCalledWith({
      from: component.from(),
      to: component.to(),
    });
  });
});
