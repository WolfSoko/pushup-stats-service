import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { StatsDashboardComponent } from './stats-dashboard.component';
import {
  PushupLiveService,
  StatsApiService,
  UserConfigApiService,
} from '@pu-stats/data-access';
import { UserContextService } from '../../user-context.service';
import { signal } from '@angular/core';

function nowLocalMinuteIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

describe('StatsDashboardComponent', () => {
  let fixture: ComponentFixture<StatsDashboardComponent>;
  const todayTs = nowLocalMinuteIso();
  const serviceMock = {
    load: vitest.fn((filter?: { from?: string; to?: string }) => {
      if (!filter?.from && !filter?.to) {
        return of({
          meta: {
            from: null,
            to: null,
            entries: 100,
            days: 25,
            total: 1200,
            granularity: 'daily',
          },
          series: [{ bucket: '2026-01-10', total: 1200, dayIntegral: 1200 }],
        });
      }

      return of({
        meta: {
          from: filter.from ?? null,
          to: filter.to ?? null,
          entries: 2,
          days: 1,
          total: 50,
          granularity: 'daily',
        },
        series: [{ bucket: '2026-01-10', total: 50, dayIntegral: 50 }],
      });
    }),
    listPushups: vitest.fn().mockReturnValue(
      of([
        {
          _id: '1',
          timestamp: '2026-02-10T13:45:00',
          reps: 8,
          source: 'wa',
          type: 'Standard',
        },
        {
          _id: '2',
          timestamp: todayTs,
          reps: 12,
          source: 'web',
          type: 'Diamond',
        },
      ])
    ),
    createPushup: vitest.fn().mockReturnValue(of({ _id: '1' })),
    updatePushup: vitest.fn().mockReturnValue(of({ _id: '1' })),
    deletePushup: vitest.fn().mockReturnValue(of({ ok: true })),
  };

  const liveTick = signal(0);
  const liveConnected = signal(false);
  const liveMock = {
    updateTick: liveTick.asReadonly(),
    connected: liveConnected.asReadonly(),
  };

  beforeEach(async () => {
    vitest.clearAllMocks();
    liveTick.set(0);
    liveConnected.set(false);
    window.history.replaceState({}, '', '/?from=2026-02-01&to=2026-02-10');

    await TestBed.configureTestingModule({
      imports: [StatsDashboardComponent],
      providers: [
        { provide: StatsApiService, useValue: serviceMock },
        { provide: PushupLiveService, useValue: liveMock },
        { provide: UserContextService, useValue: { userIdSafe: () => 'u1' } },
        {
          provide: UserConfigApiService,
          useValue: {
            getConfig: vitest.fn().mockReturnValue(
              of({
                userId: 'u1',
                dailyGoal: 100,
                ui: { showSourceColumn: false },
              })
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

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('shows german title and today focus section', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Liegestütze Statistik');
    // Title depends on selected range mode.
    expect(text).toContain('Gesamt');
    expect(text).toContain('Zielfortschritt');
    expect(text).toContain('Letzter Eintrag');
  });

  it('offers quick add buttons for 10, 20 and 30 reps', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('+10 Reps');
    expect(text).toContain('+20 Reps');
    expect(text).toContain('+30 Reps');
  });

  it('initializes filter from URL params and triggers first load with those values', () => {
    const component = fixture.componentInstance;

    expect(serviceMock.load).toHaveBeenCalledWith({
      from: '2026-02-01',
      to: '2026-02-10',
    });
    expect(serviceMock.listPushups).toHaveBeenCalledWith({
      from: '2026-02-01',
      to: '2026-02-10',
    });
    expect(component.from()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(component.to()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('loads all-time stats separately for badges', () => {
    const component = fixture.componentInstance;
    expect(component.allTimeTotal()).toBe(1200);
    expect(component.allTimeDays()).toBe(25);
    expect(component.allTimeEntries()).toBe(100);
    expect(component.allTimeAvg()).toBe('48.0');
  });

  it('computes selected period totals, latest entry and latest 10 rows', async () => {
    const component = fixture.componentInstance;

    // Switch to "day" mode by selecting today.
    const today = todayTs.slice(0, 10);
    component.from.set(today);
    component.to.set(today);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.selectedDayTotal()).toBe(12);
    expect(component.periodTotal()).toBe(12);
    expect(component.lastEntry()?._id).toBe('2');
    expect(component.latestEntries()).toHaveLength(2);
  });

  it('runs CRUD handlers and refreshes resources', async () => {
    const component = fixture.componentInstance;

    await component.onCreateEntry({
      timestamp: '2026-02-11T07:00',
      reps: 12,
      source: 'web',
    });
    expect(serviceMock.createPushup).toHaveBeenCalled();

    await component.onUpdateEntry({
      id: '1',
      timestamp: todayTs.slice(0, 16),
      reps: 14,
      source: 'wa',
    });
    expect(serviceMock.updatePushup).toHaveBeenCalledWith('1', {
      timestamp: todayTs.slice(0, 16),
      reps: 14,
      source: 'wa',
      type: undefined,
    });

    await component.onDeleteEntry('1');
    expect(serviceMock.deletePushup).toHaveBeenCalledWith('1');
  });

  it('adds quick entry via create API helper', async () => {
    const component = fixture.componentInstance;

    await component.addQuickEntry(10);

    expect(serviceMock.createPushup).toHaveBeenCalledWith(
      expect.objectContaining({ reps: 10, source: 'web', type: 'Standard' })
    );
  });

  it('reloads data when live websocket tick changes', async () => {
    const initialLoadCalls = serviceMock.load.mock.calls.length;

    liveTick.set(1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(serviceMock.load.mock.calls.length).toBeGreaterThan(
      initialLoadCalls
    );
    expect(serviceMock.listPushups.mock.calls.length).toBeGreaterThan(0);
  });

  it('shows live connection state', () => {
    liveConnected.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Live: verbunden');

    liveConnected.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Live: getrennt');
  });
});
