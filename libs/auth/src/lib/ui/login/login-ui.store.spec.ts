import { signal } from '@angular/core';
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
    signInWithEmail: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
  };

  const onboardingMock = {
    error: signal<string | null>(null),
    isOnboardingRequired: jest.fn().mockResolvedValue(true),
    saveGoogleOnboarding: jest.fn().mockResolvedValue(undefined),
  };

  async function setup() {
    const { fixture } = await render('', {
      providers: [
        LoginUiStore,
        { provide: AuthStore, useValue: authStoreMock },
        { provide: LoginOnboardingStore, useValue: onboardingMock },
      ],
    });
    return fixture.debugElement.injector.get(LoginUiStore);
  }

  it('signs in with email via auth store (given valid credentials)', async () => {
    const store = await setup();
    await store.signInWithEmail('mail@test.de', 'Secret#123');
    expect(authStoreMock.signInWithEmail).toHaveBeenCalledWith(
      'mail@test.de',
      'Secret#123'
    );
  });

  it('returns true on successful email sign-in (even before isAuthenticated signal updates)', async () => {
    // Simulate: isAuthenticated hasn't updated yet, but no error occurred
    authStoreMock.isAuthenticated.set(false);
    authStoreMock.error.set(null);
    const store = await setup();
    const result = await store.signInWithEmail('mail@test.de', 'Secret#123');
    expect(result).toBe(true);
  });

  it('returns false when email sign-in fails with error', async () => {
    authStoreMock.error.set(null);
    authStoreMock.signInWithEmail.mockImplementation(async () => {
      authStoreMock.error.set(new Error('Invalid credentials'));
    });
    const store = await setup();
    const result = await store.signInWithEmail('mail@test.de', 'wrong');
    expect(result).toBe(false);
    // Reset
    authStoreMock.signInWithEmail.mockResolvedValue(undefined);
    authStoreMock.error.set(null);
  });

  it('returns true on successful Google sign-in (even before isAuthenticated signal updates)', async () => {
    authStoreMock.isAuthenticated.set(false);
    authStoreMock.error.set(null);
    const store = await setup();
    const result = await store.signInWithGoogle();
    expect(result).toBe(true);
  });

  it('requires consent before completing google onboarding', async () => {
    const store = await setup();
    store.resetWizard('Tester');
    const result = await store.completeGoogleOnboarding();
    expect(result).toBe(false);
    expect(store.googleWizardError()).toContain('Datenverarbeitung');
  });
});
