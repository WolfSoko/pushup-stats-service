import { HttpClient } from '@angular/common/http';
import { PLATFORM_ID } from '@angular/core';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { render } from '@testing-library/angular';
import { of } from 'rxjs';
import { UserConfigApiService } from './user-config-api.service';

jest.mock('@angular/common', () => ({
  ...jest.requireActual('@angular/common'),
  isPlatformServer: jest.fn(),
}));

describe('UserConfigApiService', () => {
  let httpMock: { get: jest.Mock; put: jest.Mock };

  beforeEach(() => {
    httpMock = {
      get: jest.fn(),
      put: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('should get user config', async () => {
    const config: UserConfig = { userId: 'u', theme: 'dark' } as UserConfig;
    httpMock.get.mockReturnValue(of(config));
    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: HttpClient, useValue: httpMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = fixture.debugElement.injector.get(UserConfigApiService);
    let result: UserConfig | undefined;
    service.getConfig('u').subscribe((r) => (result = r));
    expect(result).toEqual(config);
    expect(httpMock.get).toHaveBeenCalledWith('/api/users/u/config');
  });

  it('should update user config', async () => {
    const updated: UserConfig = { userId: 'u', theme: 'light' } as UserConfig;
    httpMock.put.mockReturnValue(of(updated));
    const { fixture } = await render('', {
      providers: [
        UserConfigApiService,
        { provide: HttpClient, useValue: httpMock },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const service = fixture.debugElement.injector.get(UserConfigApiService);
    let result: UserConfig | undefined;
    service
      .updateConfig('u', { theme: 'light' } as UserConfigUpdate)
      .subscribe((r) => (result = r));
    expect(result).toEqual(updated);
    expect(httpMock.put).toHaveBeenCalledWith('/api/users/u/config', {
      theme: 'light',
    });
  });
});
