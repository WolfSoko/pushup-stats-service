import { inject, Injectable } from '@angular/core';
import {
  Functions,
  httpsCallable,
  type HttpsCallable,
  type HttpsCallableOptions,
} from '@angular/fire/functions';
import { PendingRequestsService } from '@pu-stats/data-access';

/**
 * DI seam over `httpsCallable` for the admin surface. Components inject
 * this service instead of the Firebase `Functions` token so specs can
 * fake callables with a plain `useValue` provider. Module-mocking
 * `@angular/fire/functions` (`vi.mock`) is not an option here: the test
 * bundler may place the module in a shared chunk, in which case the
 * spec's mocked `Functions` class and the component's bundled one are
 * different objects and DI fails with NG0201 — which spec breaks
 * depends on the workspace's overall spec-file set.
 *
 * Every invocation is reported to {@link PendingRequestsService}, so a
 * slow Cloud Function shows the global loading indicator. `stream` is
 * passed through untracked — a stream is a session, not a request.
 */
@Injectable({ providedIn: 'root' })
export class CallableFunctionsService {
  private readonly functions = inject(Functions);
  private readonly pending = inject(PendingRequestsService);
  private readonly httpsCallableFn: typeof httpsCallable = httpsCallable;

  call<Req = unknown, Res = unknown>(
    name: string,
    options?: HttpsCallableOptions
  ): HttpsCallable<Req, Res> {
    const callable = this.httpsCallableFn<Req, Res>(
      this.functions,
      name,
      options
    );
    const tracked = ((data?: Req | null) =>
      this.pending.track(callable(data))) as HttpsCallable<Req, Res>;
    tracked.stream = callable.stream;
    return tracked;
  }
}
