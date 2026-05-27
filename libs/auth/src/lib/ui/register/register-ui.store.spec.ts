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
    signUpWithEmail: jest.fn().mockResolvedValue(true),
    upgradeWithGoogle: jest.fn().mockResolvedValue(true),
    login: jest.fn().mockResolvedValue(true),
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

  it('Given a complete profile When submitting via email Then sign up and persist profile are executed', async () => {
    const store = await setup();
    store.setDisplayName('Alex');
    store.setDailyGoal(120);

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
    authStoreMock.upgradeWithGoogle.mockResolvedValueOnce(false);
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

  it('Given signUpWithEmail fails When signing up Then returns false', async () => {
    authStoreMock.signUpWithEmail.mockResolvedValueOnce(false);
    const store = await setup();

    const result = await store.signUpWithEmail('mail@test.de', 'Secret#123');

    expect(result).toBe(false);
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

  describe('displayName validation', () => {
    it('Given a too-short displayName Then violation is "too-short" and submission is blocked', async () => {
      const store = await setup();
      store.setDisplayName('A');
      store.setDailyGoal(10);

      expect(store.displayNameViolation()).toBe('too-short');
      expect(store.isProfileStepValid()).toBe(false);
      expect(store.canSubmit(false, false, 'Secret#123', 'Secret#123')).toBe(
        false
      );
    });

    it('Given an over-long displayName Then violation is "too-long"', async () => {
      const store = await setup();
      store.setDisplayName('A'.repeat(31));

      expect(store.displayNameViolation()).toBe('too-long');
      expect(store.isProfileStepValid()).toBe(false);
    });

    it('Given an emoji in the displayName Then violation is "invalid-characters"', async () => {
      const store = await setup();
      store.setDisplayName('Wolf🚀');

      expect(store.displayNameViolation()).toBe('invalid-characters');
      expect(store.isProfileStepValid()).toBe(false);
    });

    it('Given a valid displayName Then violation is null and isProfileStepValid is true', async () => {
      const store = await setup();
      store.setDisplayName('Alex');
      store.setDailyGoal(10);

      expect(store.displayNameViolation()).toBeNull();
      expect(store.isProfileStepValid()).toBe(true);
    });
  });

  describe('training plan preselection', () => {
    it('Given a known plan id When setSelectedPlanId Then exposes the plan and a return URL with autoStart', async () => {
      const store = await setup();

      store.setSelectedPlanId('recruit-6w-v1');

      expect(store.selectedPlanId()).toBe('recruit-6w-v1');
      expect(store.selectedPlan()?.slug).toBe('recruit-6w');
      expect(store.selectedPlanReturnUrl()).toBe(
        '/training-plans/recruit-6w?autoStart=1'
      );
    });

    it('Given an unknown plan id When setSelectedPlanId Then ignores it (no dead-end redirect)', async () => {
      const store = await setup();

      store.setSelectedPlanId('does-not-exist');

      expect(store.selectedPlanId()).toBeNull();
      expect(store.selectedPlan()).toBeNull();
      expect(store.selectedPlanReturnUrl()).toBeNull();
    });

    it('Given no plan id Then selectedPlanReturnUrl is null', async () => {
      const store = await setup();

      expect(store.selectedPlanId()).toBeNull();
      expect(store.selectedPlanReturnUrl()).toBeNull();
    });
  });
});
