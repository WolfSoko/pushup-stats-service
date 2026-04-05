import { signal } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { render } from '@testing-library/angular';
import { AuthStore } from '../../core/state/auth.store';
import { RegisterOnboardingStore } from '../../core/state/register-onboarding.store';
import { RegisterUiStore } from './register-ui.store';

describe('RegisterUiStore', () => {
  const authStoreMock = {
    loading: signal(false),
    isAuthenticated: signal(true),
    error: signal<Error | null>(null),
    user: signal<{ uid: string; email?: string; displayName?: string } | null>({
      uid: 'uid-1',
      email: 'user@test.de',
      displayName: 'Tester',
    }),
    signUpWithEmail: jest.fn().mockResolvedValue(undefined),
    upgradeWithGoogle: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue(undefined),
  };

  const onboardingMock = {
    saving: signal(false),
    saveProfile: jest.fn().mockResolvedValue(undefined),
  };

  async function setup(currentUid = 'uid-1') {
    const { fixture } = await render('', {
      providers: [
        RegisterUiStore,
        { provide: AuthStore, useValue: authStoreMock },
        { provide: RegisterOnboardingStore, useValue: onboardingMock },
        {
          provide: Auth,
          useValue: {
            currentUser: currentUid
              ? {
                  uid: currentUid,
                  email: 'user@test.de',
                  displayName: 'Tester',
                }
              : null,
          },
        },
      ],
    });
    return fixture.debugElement.injector.get(RegisterUiStore);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    authStoreMock.error.set(null);
  });

  it('Given Google registration When prepared Then profile defaults are hydrated from auth user', async () => {
    const store = await setup();

    const email = store.prepareGoogleRegistration();

    expect(email).toBe('user@test.de');
    expect(store.isGoogleRegistration()).toBe(true);
    expect(store.displayName()).toBe('Tester');
  });

  it('Given profile and consent When submitting via email Then sign up and persist profile are executed', async () => {
    const store = await setup();
    store.setDisplayName('Alex');
    store.setDailyGoal(120);
    store.setConsentAccepted(true);

    const canSubmit = store.canSubmit(false, false, 'Secret#123', 'Secret#123');
    const signedUp = await store.signUpWithEmail('mail@test.de', 'Secret#123');
    const persisted = await store.persistProfile();

    expect(canSubmit).toBe(true);
    expect(signedUp).toBe(true);
    expect(persisted).toBe(true);
    expect(authStoreMock.signUpWithEmail).toHaveBeenCalledWith(
      'mail@test.de',
      'Secret#123'
    );
    expect(onboardingMock.saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'uid-1',
        displayName: 'Alex',
        dailyGoal: 120,
        weeklyGoal: 600,
        monthlyGoal: 2400,
      })
    );
  });

  it('Given Google upgrade fails When signing in with Google Then returns false due to auth error', async () => {
    authStoreMock.upgradeWithGoogle.mockImplementationOnce(() => {
      authStoreMock.error.set(new Error('credential-already-in-use'));
      return Promise.resolve();
    });
    const store = await setup();

    const result = await store.signInWithGoogle();

    expect(result).toBe(false);
  });

  it('Given Google upgrade succeeds When signing in with Google Then returns true', async () => {
    const store = await setup();

    const result = await store.signInWithGoogle();

    expect(result).toBe(true);
    expect(authStoreMock.upgradeWithGoogle).toHaveBeenCalled();
  });

  it('Given profile save failure When persisting profile Then method returns false and keeps success unset', async () => {
    onboardingMock.saveProfile.mockRejectedValueOnce(new Error('api-failed'));
    const store = await setup();
    store.setDisplayName('Alex');
    store.setDailyGoal(120);

    const persisted = await store.persistProfile();

    expect(persisted).toBe(false);
    expect(store.registerSuccess()).toBe(false);
  });
});
