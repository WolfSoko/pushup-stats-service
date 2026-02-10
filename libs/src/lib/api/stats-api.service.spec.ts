import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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

  it('uses server-local base url and respects PORT in SSR', () => {
    const { service, httpMock } = setup('server');
    const previousPort = process.env.PORT;
    process.env.PORT = '9999';

    try {
      service.load({ to: '2026-02-10' }).subscribe();

      const req = httpMock.expectOne('http://127.0.0.1:9999/api/stats?to=2026-02-10');
      expect(req.request.method).toBe('GET');
      req.flush({ meta: {}, series: [] });
      httpMock.verify();
    } finally {
      if (previousPort === undefined) {
        delete process.env.PORT;
      } else {
        process.env.PORT = previousPort;
      }
    }
  });

  it('falls back to port 8787 on server when PORT is missing', () => {
    const { service, httpMock } = setup('server');
    const previousPort = process.env.PORT;
    delete process.env.PORT;

    try {
      service.load().subscribe();

      const req = httpMock.expectOne('http://127.0.0.1:8787/api/stats');
      expect(req.request.method).toBe('GET');
      req.flush({ meta: {}, series: [] });
      httpMock.verify();
    } finally {
      if (previousPort === undefined) {
        delete process.env.PORT;
      } else {
        process.env.PORT = previousPort;
      }
    }
  });
});
