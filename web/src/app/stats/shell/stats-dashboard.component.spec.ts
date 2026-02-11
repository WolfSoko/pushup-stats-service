import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StatsDashboardComponent } from './stats-dashboard.component';
import { PushupLiveService, StatsApiService } from '@nx-temp/stats-data-access';
import { signal } from '@angular/core';

describe('StatsDashboardComponent', () => {
  let fixture: ComponentFixture<StatsDashboardComponent>;
  const serviceMock = {
    load: jest.fn((filter?: { from?: string; to?: string }) => {
      if (!filter?.from && !filter?.to) {
        return of({
          meta: { from: null, to: null, entries: 100, days: 25, total: 1200, granularity: 'daily' },
          series: [{ bucket: '2026-01-10', total: 1200, dayIntegral: 1200 }],
        });
      }

      return of({
        meta: { from: filter.from ?? null, to: filter.to ?? null, entries: 2, days: 1, total: 50, granularity: 'daily' },
        series: [{ bucket: '2026-01-10', total: 50, dayIntegral: 50 }],
      });
    }),
    listPushups: jest.fn().mockReturnValue(
      of([{ _id: '1', timestamp: '2026-02-10T13:45:00', reps: 8, source: 'wa' }]),
    ),
    createPushup: jest.fn().mockReturnValue(of({ _id: '1' })),
    updatePushup: jest.fn().mockReturnValue(of({ _id: '1' })),
    deletePushup: jest.fn().mockReturnValue(of({ ok: true })),
  };

  const liveTick = signal(0);
  const liveMock = { updateTick: liveTick.asReadonly() };

  beforeEach(async () => {
    jest.clearAllMocks();
    liveTick.set(0);
    window.history.replaceState({}, '', '/?from=2026-02-01&to=2026-02-10');

    await TestBed.configureTestingModule({
      imports: [StatsDashboardComponent],
      providers: [
        { provide: StatsApiService, useValue: serviceMock },
        { provide: PushupLiveService, useValue: liveMock },
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

  it('shows german title and filtered total kpi card', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Liegestütze Statistik');
    expect(text).toContain('50');
  });

  it('initializes filter state from URL query params', () => {
    const component = fixture.componentInstance;
    expect(component.from()).toBe('2026-02-01');
    expect(component.to()).toBe('2026-02-10');
    expect(serviceMock.load).toHaveBeenCalledWith({ from: '2026-02-01', to: '2026-02-10' });
    expect(serviceMock.listPushups).toHaveBeenCalledWith({ from: '2026-02-01', to: '2026-02-10' });
  });

  it('loads all-time stats separately for badges', () => {
    const component = fixture.componentInstance;
    expect(component.allTimeTotal()).toBe(1200);
    expect(component.allTimeDays()).toBe(25);
    expect(component.allTimeEntries()).toBe(100);
    expect(component.allTimeAvg()).toBe('48.0');
  });

  it('runs CRUD handlers and refreshes resources', async () => {
    const component = fixture.componentInstance;

    await component.onCreateEntry({ timestamp: '2026-02-11T07:00', reps: 12, source: 'web' });
    expect(serviceMock.createPushup).toHaveBeenCalled();

    await component.onUpdateEntry({ id: '1', reps: 14, source: 'wa' });
    expect(serviceMock.updatePushup).toHaveBeenCalledWith('1', { reps: 14, source: 'wa' });

    await component.onDeleteEntry('1');
    expect(serviceMock.deletePushup).toHaveBeenCalledWith('1');
  });

  it('reloads data when live websocket tick changes', async () => {
    const initialLoadCalls = serviceMock.load.mock.calls.length;

    liveTick.set(1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(serviceMock.load.mock.calls.length).toBeGreaterThan(initialLoadCalls);
    expect(serviceMock.listPushups.mock.calls.length).toBeGreaterThan(0);
  });
});
