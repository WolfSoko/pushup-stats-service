import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PendingRequestsService } from '@pu-stats/data-access';
import { pendingRequestsInterceptor } from './pending-requests.interceptor';

describe('pendingRequestsInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let pending: PendingRequestsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([pendingRequestsInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    pending = TestBed.inject(PendingRequestsService);
  });

  afterEach(() => {
    controller.verify();
  });

  it('should count a request as pending until its response arrives', () => {
    // given
    http.get('/api/ping').subscribe();

    // then
    expect(pending.pending()).toBe(1);

    // when
    controller.expectOne('/api/ping').flush({ ok: true });

    // then
    expect(pending.pending()).toBe(0);
  });

  it('should settle the count when the request fails', () => {
    // given
    http.get('/api/ping').subscribe({ error: () => undefined });

    // when
    controller
      .expectOne('/api/ping')
      .flush('nope', { status: 500, statusText: 'Server Error' });

    // then
    expect(pending.pending()).toBe(0);
  });

  it('should settle the count when the request is cancelled', () => {
    // given
    const subscription = http.get('/api/ping').subscribe();
    expect(pending.pending()).toBe(1);

    // when
    subscription.unsubscribe();

    // then
    expect(pending.pending()).toBe(0);
    controller.expectOne('/api/ping');
  });
});
