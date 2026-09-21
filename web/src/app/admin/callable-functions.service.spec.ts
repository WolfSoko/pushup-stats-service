import { TestBed } from '@angular/core/testing';
import { Functions } from '@angular/fire/functions';
import { CallableFunctionsService } from './callable-functions.service';
import { PendingRequestsService } from '@pu-stats/data-access';

describe('CallableFunctionsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: Functions, useValue: {} }],
    });
  });

  it('should be injectable with the Functions token provided via DI', () => {
    // given / when
    const service = TestBed.inject(CallableFunctionsService);

    // then
    expect(service).toBeInstanceOf(CallableFunctionsService);
  });

  it('should create an invocable callable for a function name', () => {
    // given
    const service = TestBed.inject(CallableFunctionsService);

    // when
    const fn = service.call('adminListUsers');

    // then
    expect(typeof fn).toBe('function');
  });

  describe('pending-request tracking', () => {
    function setupFakeCallable(): {
      service: CallableFunctionsService;
      pending: PendingRequestsService;
      resolve: () => void;
      invoked: ReturnType<typeof vi.fn>;
      stream: ReturnType<typeof vi.fn>;
    } {
      const service = TestBed.inject(CallableFunctionsService);
      const pending = TestBed.inject(PendingRequestsService);
      let resolve!: () => void;
      const result = new Promise<{ data: unknown }>((res) => {
        resolve = () => res({ data: 'done' });
      });
      const invoked = vi.fn().mockReturnValue(result);
      const stream = vi.fn();
      const fake = Object.assign(invoked, { stream });
      Object.defineProperty(service, 'httpsCallableFn', {
        value: vi.fn().mockReturnValue(fake),
      });
      return { service, pending, resolve, invoked, stream };
    }

    it('should count an invocation as pending until the function answers', async () => {
      // given
      const { service, pending, resolve, invoked } = setupFakeCallable();
      const fn = service.call<{ id: string }, string>('adminListUsers');

      // when
      const call = fn({ id: 'x' });

      // then
      expect(invoked).toHaveBeenCalledWith({ id: 'x' });
      expect(pending.pending()).toBe(1);

      // when
      resolve();
      await expect(call).resolves.toEqual({ data: 'done' });

      // then
      expect(pending.pending()).toBe(0);
    });

    it('should pass the stream entry point through untouched', () => {
      // given
      const { service, stream } = setupFakeCallable();

      // when
      const fn = service.call('adminListUsers');

      // then
      expect(fn.stream).toBe(stream);
    });
  });
});
