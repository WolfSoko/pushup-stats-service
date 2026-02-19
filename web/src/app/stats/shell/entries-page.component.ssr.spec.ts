import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EntriesPageComponent } from './entries-page.component';
import { PushupLiveDataService, StatsApiService } from '@pu-stats/data-access';

describe('EntriesPageComponent (SSR/REST)', () => {
  let fixture: ComponentFixture<EntriesPageComponent>;

  const rows = [
    {
      _id: '1',
      timestamp: '2026-02-10T08:00:00',
      reps: 10,
      source: 'wa',
      type: 'Standard',
    },
  ];

  const apiMock = {
    listPushups: vitest.fn().mockReturnValue(of(rows)),
    deletePushup: vitest.fn().mockReturnValue(of({ ok: true })),
    createPushup: vitest.fn().mockReturnValue(of({ _id: 'x' })),
    updatePushup: vitest.fn().mockReturnValue(of({ _id: '1' })),
  };

  const liveMock = {
    connected: () => false,
    entries: () => [],
  };

  beforeEach(async () => {
    vitest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [EntriesPageComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: StatsApiService, useValue: apiMock },
        { provide: PushupLiveDataService, useValue: liveMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EntriesPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads rows via REST on server', () => {
    const component = fixture.componentInstance;
    expect(apiMock.listPushups).toHaveBeenCalled();
    expect(component.rows().map((x) => x._id)).toEqual(['1']);
  });
});
