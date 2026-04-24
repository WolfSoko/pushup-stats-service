import { computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable } from 'rxjs';
import { User } from '@firebase/auth';
import { toAuthUserSignal } from './to-auth-user-signal';

describe('toAuthUserSignal', () => {
  it('propagates same-reference emissions (linkWithCredential anonymous → permanent)', () => {
    // Regression for #143: after upgrade, PreviewBannerComponent stayed visible
    // because Firebase reused the same User reference and toSignal()'s default
    // Object.is equality dropped the emission.
    const subject = new BehaviorSubject<User | null>(null);

    TestBed.runInInjectionContext(() => {
      const sig = toAuthUserSignal(
        subject.asObservable() as Observable<User | null>
      );
      const isAnon = computed(() => sig()?.isAnonymous ?? false);

      const user = { uid: 'u1', isAnonymous: true } as unknown as User;
      subject.next(user);
      expect(isAnon()).toBe(true);

      // Firebase mutates the same User object in-place after
      // linkWithCredential — the observable emits the SAME reference.
      (user as { isAnonymous: boolean }).isAnonymous = false;
      subject.next(user);
      expect(isAnon()).toBe(false);
    });
  });

  it('emits null when the observable clears the user (sign-out)', () => {
    const subject = new BehaviorSubject<User | null>(null);
    TestBed.runInInjectionContext(() => {
      const sig = toAuthUserSignal(
        subject.asObservable() as Observable<User | null>
      );
      subject.next({ uid: 'u1', isAnonymous: false } as unknown as User);
      expect(sig()).not.toBeNull();
      subject.next(null);
      expect(sig()).toBeNull();
    });
  });
});
