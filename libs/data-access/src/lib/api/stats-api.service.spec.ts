import { isPlatformServer } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { PLATFORM_ID, TransferState } from '@angular/core';
import { PushupRecord } from '@pu-stats/models';
import { render } from '@testing-library/angular';
import { of } from 'rxjs';
import { StatsApiService } from './stats-api.service';

jest.mock('@angular/common', () => ({
  ...jest.requireActual('@angular/common'),
  isPlatformServer: jest.fn(),
}));

describe('StatsApiService', () => {
  let httpMock: {
    get: jest.Mock;
    post: jest.Mock;
    put: jest.Mock;
    delete: jest.Mock;
  };
  let transferStateMock: {
    get: jest.Mock;
    set: jest.Mock;
    hasKey: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(() => {
    httpMock = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    };
    transferStateMock = {
      get: jest.fn(),
      set: jest.fn(),
      hasKey: jest.fn(),
      remove: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('should load stats from cache if available (given not server, hasKey true)', async () => {
    (isPlatformServer as jest.Mock).mockReturnValue(false);
    transferStateMock.hasKey.mockReturnValue(true);
    transferStateMock.get.mockReturnValue({ meta: {}, series: [] });
    const { fixture } = await render('', {
      providers: [
        StatsApiService,
        { provide: HttpClient, useValue: httpMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: TransferState, useValue: transferStateMock },
      ],
    });
    const service = fixture.debugElement.injector.get(StatsApiService);
    const result$ = service.load();
    let result: unknown;
    result$.subscribe((r) => (result = r));
    expect(result).toEqual({ meta: {}, series: [] });
    expect(transferStateMock.remove).toHaveBeenCalled();
  });

  it('should load stats from http if not cached (given not server, hasKey false)', async () => {
    (isPlatformServer as jest.Mock).mockReturnValue(false);
    transferStateMock.hasKey.mockReturnValue(false);
    httpMock.get.mockReturnValue(of({ meta: { total: 1 }, series: [] }));
    const { fixture } = await render('', {
      providers: [
        StatsApiService,
        { provide: HttpClient, useValue: httpMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: TransferState, useValue: transferStateMock },
      ],
    });
    const service = fixture.debugElement.injector.get(StatsApiService);
    const result$ = service.load();
    let result: unknown;
    result$.subscribe((r) => (result = r));
    expect(result).toEqual({ meta: { total: 1 }, series: [] });
    expect(httpMock.get).toHaveBeenCalled();
  });

  it('should set transfer state on server after http get', async () => {
    (isPlatformServer as jest.Mock).mockReturnValue(true);
    httpMock.get.mockReturnValue(of({ meta: { total: 2 }, series: [] }));
    const { fixture } = await render('', {
      providers: [
        StatsApiService,
        { provide: HttpClient, useValue: httpMock },
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: TransferState, useValue: transferStateMock },
      ],
    });
    const service = fixture.debugElement.injector.get(StatsApiService);
    const result$ = service.load();
    let result: unknown;
    result$.subscribe((r) => (result = r));
    expect(result).toEqual({ meta: { total: 2 }, series: [] });
    expect(transferStateMock.set).toHaveBeenCalled();
  });

  it('should filter pushups in listPushups', async () => {
    const pushups: PushupRecord[] = [
      { _id: '1', timestamp: '2024-01-01T00:00:00Z', reps: 10, source: 's' },
      { _id: '2', timestamp: '2024-01-10T00:00:00Z', reps: 5, source: 's' },
    ];
    httpMock.get.mockReturnValue(of(pushups));
    const { fixture } = await render('', {
      providers: [
        StatsApiService,
        { provide: HttpClient, useValue: httpMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: TransferState, useValue: transferStateMock },
      ],
    });
    const service = fixture.debugElement.injector.get(StatsApiService);
    const result$ = service.listPushups({ from: '2024-01-05' });
    let result: unknown;
    result$.subscribe((r) => (result = r));
    expect(result).toEqual([
      { _id: '2', timestamp: '2024-01-10T00:00:00Z', reps: 5, source: 's' },
    ]);
  });

  it('should call http post/put/delete for create/update/delete', async () => {
    httpMock.post.mockReturnValue(
      of({ _id: '1', timestamp: '', reps: 1, source: '' })
    );
    httpMock.put.mockReturnValue(
      of({ _id: '1', timestamp: '', reps: 2, source: '' })
    );
    httpMock.delete.mockReturnValue(of({ ok: true }));
    const { fixture } = await render('', {
      providers: [
        StatsApiService,
        { provide: HttpClient, useValue: httpMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: TransferState, useValue: transferStateMock },
      ],
    });
    const service = fixture.debugElement.injector.get(StatsApiService);
    const create$ = service.createPushup({ timestamp: '', reps: 1 });
    const update$ = service.updatePushup('1', { reps: 2 });
    const delete$ = service.deletePushup('1');
    let createResult, updateResult, deleteResult;
    create$.subscribe((r) => (createResult = r));
    update$.subscribe((r) => (updateResult = r));
    delete$.subscribe((r) => (deleteResult = r));
    expect(createResult).toEqual({
      _id: '1',
      timestamp: '',
      reps: 1,
      source: '',
    });
    expect(updateResult).toEqual({
      _id: '1',
      timestamp: '',
      reps: 2,
      source: '',
    });
    expect(deleteResult).toEqual({ ok: true });
  });
});
