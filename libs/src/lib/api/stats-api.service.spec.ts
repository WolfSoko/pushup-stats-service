import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { StatsApiService } from './stats-api.service';

describe('StatsApiService', () => {
  let service: StatsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(StatsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('builds query params for from/to filter', () => {
    service.load({ from: '2026-01-01', to: '2026-01-31' }).subscribe();

    const req = httpMock.expectOne('/api/stats?from=2026-01-01&to=2026-01-31');
    expect(req.request.method).toBe('GET');
    req.flush({ meta: {}, series: [] });
  });
});
