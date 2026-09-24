import { TestBed } from '@angular/core/testing';
import {
  PENDING_INDICATOR_DELAY_MS,
  PENDING_INDICATOR_MIN_VISIBLE_MS,
  PendingRequestsService,
} from './pending-requests.service';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('PendingRequestsService', () => {
  let service: PendingRequestsService;

  beforeEach(() => {
    jest.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PendingRequestsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should start with nothing pending and the indicator hidden', () => {
    // then
    expect(service.pending()).toBe(0);
    expect(service.visible()).toBe(false);
  });

  it('should count a tracked request as pending until it resolves', async () => {
    // given
    const request = deferred<string>();

    // when
    const tracked = service.track(request.promise);

    // then
    expect(service.pending()).toBe(1);

    // when
    request.resolve('ok');
    await expect(tracked).resolves.toBe('ok');

    // then
    expect(service.pending()).toBe(0);
  });

  it('should keep the indicator hidden for a request that settles within the delay', async () => {
    // given
    const request = deferred<void>();
    void service.track(request.promise);

    // when
    jest.advanceTimersByTime(PENDING_INDICATOR_DELAY_MS - 1);
    request.resolve();
    await flushMicrotasks();
    jest.advanceTimersByTime(PENDING_INDICATOR_DELAY_MS * 2);

    // then
    expect(service.visible()).toBe(false);
  });

  it('should show the indicator once a request has been pending for the delay', () => {
    // given
    const request = deferred<void>();
    void service.track(request.promise);

    // when
    jest.advanceTimersByTime(PENDING_INDICATOR_DELAY_MS - 1);

    // then
    expect(service.visible()).toBe(false);

    // when
    jest.advanceTimersByTime(1);

    // then
    expect(service.visible()).toBe(true);
  });

  it('should keep the indicator visible for the minimum time after a slow request settles', async () => {
    // given
    const request = deferred<void>();
    void service.track(request.promise);
    jest.advanceTimersByTime(PENDING_INDICATOR_DELAY_MS);
    expect(service.visible()).toBe(true);

    // when
    request.resolve();
    await flushMicrotasks();

    // then
    expect(service.visible()).toBe(true);

    // when
    jest.advanceTimersByTime(PENDING_INDICATOR_MIN_VISIBLE_MS - 1);

    // then
    expect(service.visible()).toBe(true);

    // when
    jest.advanceTimersByTime(1);

    // then
    expect(service.visible()).toBe(false);
  });

  it('should hide immediately when the request outlived the minimum visible time', async () => {
    // given
    const request = deferred<void>();
    void service.track(request.promise);
    jest.advanceTimersByTime(
      PENDING_INDICATOR_DELAY_MS + PENDING_INDICATOR_MIN_VISIBLE_MS
    );

    // when
    request.resolve();
    await flushMicrotasks();

    // then
    expect(service.visible()).toBe(false);
  });

  it('should stay visible while overlapping requests are still in flight', async () => {
    // given
    const first = deferred<void>();
    const second = deferred<void>();
    void service.track(first.promise);
    jest.advanceTimersByTime(PENDING_INDICATOR_DELAY_MS);
    void service.track(second.promise);
    expect(service.pending()).toBe(2);

    // when
    first.resolve();
    await flushMicrotasks();
    jest.advanceTimersByTime(PENDING_INDICATOR_MIN_VISIBLE_MS * 4);

    // then
    expect(service.pending()).toBe(1);
    expect(service.visible()).toBe(true);

    // when
    second.resolve();
    await flushMicrotasks();
    jest.advanceTimersByTime(PENDING_INDICATOR_MIN_VISIBLE_MS);

    // then
    expect(service.pending()).toBe(0);
    expect(service.visible()).toBe(false);
  });

  it('should cancel a scheduled hide when a new request starts during the grace period', async () => {
    // given
    const first = deferred<void>();
    void service.track(first.promise);
    jest.advanceTimersByTime(PENDING_INDICATOR_DELAY_MS);
    first.resolve();
    await flushMicrotasks();

    // when
    const second = deferred<void>();
    void service.track(second.promise);
    jest.advanceTimersByTime(PENDING_INDICATOR_MIN_VISIBLE_MS * 4);

    // then
    expect(service.visible()).toBe(true);
  });

  it('should settle the count and rethrow when a tracked request rejects', async () => {
    // given
    const request = deferred<void>();
    const tracked = service.track(request.promise);

    // when
    request.reject(new Error('boom'));

    // then
    await expect(tracked).rejects.toThrow('boom');
    expect(service.pending()).toBe(0);
  });

  it('should ignore an end without a matching begin', () => {
    // when
    service.end();

    // then
    expect(service.pending()).toBe(0);
  });

  it('should not show the indicator when begin and end bracket a fast request', () => {
    // given
    service.begin();

    // when
    service.end();
    jest.advanceTimersByTime(PENDING_INDICATOR_DELAY_MS * 2);

    // then
    expect(service.visible()).toBe(false);
  });
});
