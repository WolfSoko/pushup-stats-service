import { Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { User } from '@firebase/auth';

/**
 * Firebase mutates the same `User` object in place after `linkWithCredential`
 * (anonymous → permanent upgrade). `toSignal()`'s default `Object.is` equality
 * check would silently drop those same-reference emissions, leaving downstream
 * signals (e.g. `isGuest`) stuck at the pre-upgrade value. Force every emission
 * through by overriding the equality check.
 */
export function toAuthUserSignal(
  obs$: Observable<User | null>
): Signal<User | null | undefined> {
  return toSignal(obs$, { equal: () => false });
}
