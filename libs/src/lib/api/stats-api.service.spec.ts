import { PLATFORM_ID, TransferState, makeStateKey } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { StatsResponse } from '@pu-stats/models';
import { StatsApiService } from './stats-api.service';

describe('StatsApiService', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function setup(platformId: 'browser' | 'server') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });

    return {
      service: TestBed.inject(StatsApiService),
      httpMock: TestBed.inject(HttpTestingController),
    };
  }

  it('builds query params for from/to filter in browser', () => {
    const { service, httpMock } = setup('browser');

    service.load({ from: '2026-01-01', to: '2026-01-31' }).subscribe();

    const req = httpMock.expectOne('/api/stats?from=2026-01-01&to=2026-01-31');
    expect(req.request.method).toBe('GET');
    req.flush({ meta: {}, series: [] });
    httpMock.verify();
  });

  it('omits query when no filter is provided', () => {
    const { service, httpMock } = setup('browser');

    service.load().subscribe();

    const req = httpMock.expectOne('/api/stats');
    expect(req.request.method).toBe('GET');
    req.flush({ meta: {}, series: [] });
    httpMock.verify();
  });

  it('supports single-sided filter (from only)', () => {
    const { service, httpMock } = setup('browser');

    service.load({ from: '2026-02-01' }).subscribe();

    const req = httpMock.expectOne('/api/stats?from=2026-02-01');
    expect(req.request.method).toBe('GET');
    req.flush({ meta: {}, series: [] });
    httpMock.verify();
  });

  it('reuses TransferState payload on browser without extra HTTP call', () => {
    const { service, httpMock } = setup('browser');
    const transferState = TestBed.inject(TransferState);
    const key = makeStateKey<StatsResponse>(
      'stats:from=2026-02-01&to=2026-02-10',
    );
    const cachedPayload = {
      meta: {
        from: '2026-02-01',
        to: '2026-02-10',
        entries: 2,
        days: 1,
        total: 15,
        granularity: 'daily',
      },
      series: [{ bucket: '2026-02-10', total: 15, dayIntegral: 15 }],
    };

    transferState.set(key, cachedPayload);

    let value: StatsResponse | null = null;
    service
      .load({ from: '2026-02-01', to: '2026-02-10' })
      .subscribe((v) => (value = v));

    expect(value).toEqual(cachedPayload);
    httpMock.expectNone('/api/stats?from=2026-02-01&to=2026-02-10');
    httpMock.verify();
  });

  it('uses server-local base url and respects API_PORT in SSR', () => {
    const { service, httpMock } = setup('server');
    const previousPort = process.env.API_PORT;
    const previousHost = process.env.API_HOST;
    process.env.API_PORT = '9999';
    delete process.env.API_HOST;

    try {
      service.load({ to: '2026-02-10' }).subscribe();

      const req = httpMock.expectOne(
        'http://127.0.0.1:9999/api/stats?to=2026-02-10',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ meta: {}, series: [] });
      httpMock.verify();
    } finally {
      if (previousPort === undefined) {
        delete process.env.API_PORT;
      } else {
        process.env.API_PORT = previousPort;
      }
      if (previousHost === undefined) {
        delete process.env.API_HOST;
      } else {
        process.env.API_HOST = previousHost;
      }
    }
  });

  it('respects API_HOST on server', () => {
    const { service, httpMock } = setup('server');
    const previousPort = process.env.API_PORT;
    const previousHost = process.env.API_HOST;
    process.env.API_PORT = '8788';
    process.env.API_HOST = 'api';

    try {
      service.load({ to: '2026-02-10' }).subscribe();

      const req = httpMock.expectOne(
        'http://api:8788/api/stats?to=2026-02-10',
      );
      expect(req.request.method).toBe('GET');
      req.flush({ meta: {}, series: [] });
      httpMock.verify();
    } finally {
      if (previousPort === undefined) {
        delete process.env.API_PORT;
      } else {
        process.env.API_PORT = previousPort;
      }
      if (previousHost === undefined) {
        delete process.env.API_HOST;
      } else {
        process.env.API_HOST = previousHost;
      }
    }
  });

  it('falls back to port 8787 on server when API_PORT is missing', () => {
    const { service, httpMock } = setup('server');
    const previousPort = process.env.API_PORT;
    const previousHost = process.env.API_HOST;
    delete process.env.API_PORT;
    delete process.env.API_HOST;

    try {
      service.load().subscribe();

      const req = httpMock.expectOne('http://127.0.0.1:8787/api/stats');
      expect(req.request.method).toBe('GET');
      req.flush({ meta: {}, series: [] });
      httpMock.verify();
    } finally {
      if (previousPort === undefined) {
        delete process.env.API_PORT;
      } else {
        process.env.API_PORT = previousPort;
      }
      if (previousHost === undefined) {
        delete process.env.API_HOST;
      } else {
        process.env.API_HOST = previousHost;
      }
    }
  });

  it('lists pushups and filters by date range client-side', () => {
    const { service, httpMock } = setup('browser');

    let rows: Array<{ _id: string }> = [];
    service
      .listPushups({ from: '2026-02-10', to: '2026-02-10' })
      .subscribe((v) => (rows = v));

    const req = httpMock.expectOne('/api/pushups');
    expect(req.request.method).toBe('GET');
    req.flush([
      { _id: '1', timestamp: '2026-02-09T10:00:00', reps: 10, source: 'wa' },
      { _id: '2', timestamp: '2026-02-10T10:00:00', reps: 12, source: 'wa' },
    ]);

    expect(rows.map((x) => x._id)).toEqual(['2']);
    httpMock.verify();
  });

  it('creates pushup via POST', () => {
    const { service, httpMock } = setup('browser');

    service
      .createPushup({ timestamp: '2026-02-11T07:00', reps: 15, source: 'web' })
      .subscribe();

    const req = httpMock.expectOne('/api/pushups');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      timestamp: '2026-02-11T07:00',
      reps: 15,
      source: 'web',
    });
    req.flush({
      _id: '1',
      timestamp: '2026-02-11T07:00',
      reps: 15,
      source: 'web',
    });
    httpMock.verify();
  });

  it('updates pushup via PUT', () => {
    const { service, httpMock } = setup('browser');

    service.updatePushup('abc', { reps: 20 }).subscribe();

    const req = httpMock.expectOne('/api/pushups/abc');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ reps: 20 });
    req.flush({
      _id: 'abc',
      timestamp: '2026-02-11T07:00',
      reps: 20,
      source: 'web',
    });
    httpMock.verify();
  });

  it('deletes pushup via DELETE', () => {
    const { service, httpMock } = setup('browser');

    service.deletePushup('abc').subscribe();

    const req = httpMock.expectOne('/api/pushups/abc');
    expect(req.request.method).toBe('DELETE');
    req.flush({ ok: true });
    httpMock.verify();
  });
});
