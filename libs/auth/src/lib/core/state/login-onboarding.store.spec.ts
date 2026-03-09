import { render } from '@testing-library/angular';
import { of, throwError } from 'rxjs';
import { UserConfigApiService } from '@pu-stats/data-access';
import { LoginOnboardingStore } from './login-onboarding.store';

describe('LoginOnboardingStore', () => {
  const userConfigApiMock = {
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
  };

  async function setup() {
    const { fixture } = await render('', {
      providers: [
        LoginOnboardingStore,
        { provide: UserConfigApiService, useValue: userConfigApiMock },
      ],
    });
    return fixture.debugElement.injector.get(LoginOnboardingStore);
  }

  it('returns true when config has missing onboarding fields', async () => {
    userConfigApiMock.getConfig.mockReturnValue(
      of({ userId: 'u1', displayName: '', dailyGoal: 0 })
    );
    const store = await setup();
    await expect(store.isOnboardingRequired('u1')).resolves.toBe(true);
  });

  it('sets error and throws when save fails', async () => {
    userConfigApiMock.updateConfig.mockReturnValue(
      throwError(() => new Error('failed'))
    );
    const store = await setup();
    await expect(
      store.saveGoogleOnboarding('u1', { displayName: 'A', dailyGoal: 10 })
    ).rejects.toThrow();
    expect(store.error()).toContain('Onboarding');
  });
});
