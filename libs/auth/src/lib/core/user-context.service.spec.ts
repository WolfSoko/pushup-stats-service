import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, signal } from '@angular/core';
import { UserContextService } from './user-context.service';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { AuthStore } from '@pu-auth/auth';

type User = {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  isAnonymous?: boolean;
};

class AuthStoreStub {
  user = signal<User | null>(null);
}

describe('UserContextService', () => {
  let authStore: AuthStoreStub;

  beforeEach(() => {
    authStore = new AuthStoreStub();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: AuthStore, useValue: authStore },
      ],
    });
  });

  it('uses auth user uid when available', () => {
    const service = TestBed.inject(UserContextService);
    authStore.user.set({ uid: 'firebase-user' });
    expect(service.userIdSafe()).toBe('firebase-user');
  });

  it('uses auth user displayName when available', () => {
    const service = TestBed.inject(UserContextService);
    authStore.user.set({ uid: '123', displayName: 'firebase-user' });
    expect(service.userNameSafe()).toBe('firebase-user');
  });

  it('falls back to email when displayName is missing', () => {
    const service = TestBed.inject(UserContextService);
    authStore.user.set({ uid: '123', email: 'firebase@user' });
    expect(service.userNameSafe()).toBe('firebase@user');
  });

  it('resets userId to empty string on logout', () => {
    const service = TestBed.inject(UserContextService);
    authStore.user.set({ uid: 'firebase-user' });
    expect(service.userIdSafe()).toBe('firebase-user');

    authStore.user.set(null);
    expect(service.userIdSafe()).toBe('');
  });
});
