import { signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { render } from '@testing-library/angular';
import { AuthStore } from '../../core/state/auth.store';
import { LoginOnboardingStore } from '../../core/state/login-onboarding.store';
import { LoginUiStore } from './login-ui.store';

describe('LoginUiStore', () => {
  const authStoreMock = {
    loading: signal(false),
    error: signal<Error | null>(null),
    isAuthenticated: signal(true),
    user: signal<{ uid: string; displayName?: string } | null>({
      uid: 'u1',
      displayName: 'Tester',
    }),
    signInWithEmail: jest.fn().mockResolvedValue(true),
    login: jest.fn().mockResolvedValue(true),
    logout: jest.fn().mockResolvedValue(undefined),
  };

  const onboardingMock = {
    error: signal<string | null>(null),
    isOnboardingRequired: jest.fn().mockResolvedValue(true),
    saveGoogleOnboarding: jest.fn().mockResolvedValue(undefined),
  };

  const firebaseAuthMock = {
    currentUser: { uid: 'u1', displayName: 'Tester' },
  };

  beforeEach(() => {
    authStoreMock.loading.set(false);
    authStoreMock.error.set(null);
    authStoreMock.isAuthenticated.set(true);
    authStoreMock.user.set({ uid: 'u1', displayName: 'Tester' });
    authStoreMock.signInWithEmail.mockResolvedValue(true);
    authStoreMock.login.mockResolvedValue(true);
    authStoreMock.logout.mockResolvedValue(undefined);
    onboardingMock.error.set(null);
  });

  async function setup() {
    const { fixture } = await render('', {
      providers: [
        LoginUiStore,
        { provide: AuthStore, useValue: authStoreMock },
        { provide: LoginOnboardingStore, useValue: onboardingMock },
        { provide: Auth, useValue: firebaseAuthMock },
      ],
    });
    return fixture.debugElement.injector.get(LoginUiStore);
  }

  it('signs in with email via auth store (given valid credentials)', async () => {
    // Given
    const store = await setup();
    // When
    await store.signInWithEmail('mail@test.de', 'Secret#123');
    // Then
    expect(authStoreMock.signInWithEmail).toHaveBeenCalledWith(
      'mail@test.de',
      'Secret#123'
    );
  });

  it('returns true when authStore.signInWithEmail resolves with true', async () => {
    // Given – authStore returns true (success, no error)
    authStoreMock.signInWithEmail.mockResolvedValue(true);
    const store = await setup();
    // When
    const result = await store.signInWithEmail('mail@test.de', 'Secret#123');
    // Then
    expect(result).toBe(true);
  });

  it('returns false when authStore.signInWithEmail resolves with false (auth error)', async () => {
    // Given – authStore returns false (login failed, error signal already set internally)
    authStoreMock.signInWithEmail.mockResolvedValue(false);
    const store = await setup();
    // When
    const result = await store.signInWithEmail('mail@test.de', 'wrong');
    // Then – result directly reflects authStore outcome, no signal-read race
    expect(result).toBe(false);
  });

  it('returns true when authStore.login resolves with true (Google sign-in)', async () => {
    // Given
    authStoreMock.login.mockResolvedValue(true);
    const store = await setup();
    // When
    const result = await store.signInWithGoogle();
    // Then
    expect(result).toBe(true);
  });

  it('returns false when authStore.login resolves with false (Google sign-in failed)', async () => {
    // Given
    authStoreMock.login.mockResolvedValue(false);
    const store = await setup();
    // When
    const result = await store.signInWithGoogle();
    // Then
    expect(result).toBe(false);
  });

  it('requires consent before completing google onboarding', async () => {
    // Given
    const store = await setup();
    store.resetWizard('Tester');
    // When
    const result = await store.completeGoogleOnboarding();
    // Then
    expect(result).toBe(false);
    expect(store.googleWizardError()).toContain('Datenverarbeitung');
  });
});
