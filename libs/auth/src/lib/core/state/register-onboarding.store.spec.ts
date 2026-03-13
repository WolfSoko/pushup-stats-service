import { render } from '@testing-library/angular';
import { of, throwError } from 'rxjs';
import { UserConfigApiService } from '@pu-stats/data-access';
import { RegisterOnboardingStore } from './register-onboarding.store';

describe('RegisterOnboardingStore', () => {
  const userConfigApiMock = {
    updateConfig: jest.fn(),
  };

  async function setup() {
    const { fixture } = await render('', {
      providers: [
        RegisterOnboardingStore,
        { provide: UserConfigApiService, useValue: userConfigApiMock },
      ],
    });
    return fixture.debugElement.injector.get(RegisterOnboardingStore);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saves profile data via data-access service', async () => {
    userConfigApiMock.updateConfig.mockReturnValue(of({ userId: 'uid-1' }));
    const store = await setup();

    await store.saveProfile({
      uid: 'uid-1',
      displayName: ' Ana ',
      dailyGoal: 0,
    });

    expect(userConfigApiMock.updateConfig).toHaveBeenCalledWith(
      'uid-1',
      expect.objectContaining({ displayName: 'Ana', dailyGoal: 100 })
    );
    expect(store.saving()).toBe(false);
  });

  it('sets translated error and throws when persistence fails', async () => {
    userConfigApiMock.updateConfig.mockReturnValue(
      throwError(() => new Error('boom'))
    );
    const store = await setup();

    await expect(
      store.saveProfile({ uid: 'uid-1', displayName: 'Ana', dailyGoal: 10 })
    ).rejects.toThrow('save-register-profile-failed');

    expect(store.error()).toContain('Profil konnte nicht gespeichert');
  });
});
