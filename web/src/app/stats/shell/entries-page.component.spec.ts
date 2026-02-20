import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EntriesPageComponent } from './entries-page.component';
import { PushupLiveDataService, StatsApiService } from '@pu-stats/data-access';

describe('EntriesPageComponent', () => {
  let fixture: ComponentFixture<EntriesPageComponent>;

  const rows = [
    {
      _id: '1',
      timestamp: '2026-02-10T08:00:00',
      reps: 10,
      source: 'wa',
      type: 'Standard',
    },
    {
      _id: '2',
      timestamp: '2026-02-11T09:00:00',
      reps: 25,
      source: 'web',
      type: 'Diamond',
    },
    {
      _id: '3',
      timestamp: '2026-02-11T11:00:00',
      reps: 15,
      source: 'wa',
      type: 'Wide',
    },
  ];

  const apiMock = {
    listPushups: vitest.fn().mockReturnValue(of(rows)),
    deletePushup: vitest.fn().mockReturnValue(of({ ok: true })),
    createPushup: vitest.fn().mockReturnValue(of({ _id: 'x' })),
    updatePushup: vitest.fn().mockReturnValue(of({ _id: '1' })),
  };

  const liveMock = {
    connected: signal(true),
    entries: signal(rows),
  };

  beforeEach(async () => {
    vitest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [EntriesPageComponent],
      providers: [
        { provide: StatsApiService, useValue: apiMock },
        { provide: PushupLiveDataService, useValue: liveMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EntriesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('prefills date range with oldest and today (browser uses live entries)', () => {
    const component = fixture.componentInstance;
    expect(component.from()).toBe('2026-02-10');
    expect(component.to()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('applies source, type and reps filter', () => {
    const component = fixture.componentInstance;

    component.source.set('wa');
    component.type.set('Wide');
    component.repsMin.set(11);

    expect(component.filteredRows().map((x) => x._id)).toEqual(['3']);
  });

  it('creates an entry via api', async () => {
    const component = fixture.componentInstance;

    await component.onCreateEntry({
      timestamp: '2026-02-11T20:00',
      reps: 12,
      source: 'web',
    });

    expect(apiMock.createPushup).toHaveBeenCalledWith({
      timestamp: '2026-02-11T20:00',
      reps: 12,
      source: 'web',
    });
  });

  it('updates an entry via api', async () => {
    const component = fixture.componentInstance;

    await component.onUpdateEntry({
      id: '1',
      timestamp: '2026-02-11T20:00',
      reps: 14,
      source: 'web',
      type: 'Diamond',
    });

    expect(apiMock.updatePushup).toHaveBeenCalledWith('1', {
      timestamp: '2026-02-11T20:00',
      reps: 14,
      source: 'web',
      type: 'Diamond',
    });
  });

  it('deletes a single row via api', async () => {
    const component = fixture.componentInstance;

    await component.onDeleteEntry('2');

    expect(apiMock.deletePushup).toHaveBeenCalledWith('2');
  });
});
