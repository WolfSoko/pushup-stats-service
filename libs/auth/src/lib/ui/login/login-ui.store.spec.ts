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
    signInWithEmail: vi.fn().mockResolvedValue(undefined),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
  };

  const onboardingMock = {
    error: signal<string | null>(null),
    isOnboardingRequired: vi.fn().mockResolvedValue(true),
    saveGoogleOnboarding: vi.fn().mockResolvedValue(undefined),
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

  it('requires consent before completing google onboarding', async () => {
    const store = await setup();
    store.resetWizard('Tester');
    const result = await store.completeGoogleOnboarding();
    expect(result).toBe(false);
    expect(store.googleWizardError()).toContain('Datenverarbeitung');
  });
});
