import { inject, Injectable } from '@angular/core';
import {
  Functions,
  httpsCallable,
  type HttpsCallable,
  type HttpsCallableOptions,
} from '@angular/fire/functions';

/**
 * DI seam over `httpsCallable` for the admin surface. Components inject
 * this service instead of the Firebase `Functions` token so specs can
 * fake callables with a plain `useValue` provider. Module-mocking
 * `@angular/fire/functions` (`vi.mock`) is not an option here: the test
 * bundler may place the module in a shared chunk, in which case the
 * spec's mocked `Functions` class and the component's bundled one are
 * different objects and DI fails with NG0201 — which spec breaks
 * depends on the workspace's overall spec-file set.
 */
@Injectable({ providedIn: 'root' })
export class CallableFunctionsService {
  private readonly functions = inject(Functions);

  call<Req = unknown, Res = unknown>(
    name: string,
    options?: HttpsCallableOptions
  ): HttpsCallable<Req, Res> {
    return httpsCallable<Req, Res>(this.functions, name, options);
  }
}
