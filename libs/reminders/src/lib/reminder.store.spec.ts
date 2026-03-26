import { signal } from '@angular/core';
import { render } from '@testing-library/angular';
import { of, throwError } from 'rxjs';
import { UserConfigApiService } from '@pu-stats/data-access';
import { ReminderStore } from './reminder.store';
import { ReminderPermissionService } from './reminder-permission.service';
import type { ReminderConfig } from '@pu-stats/models';

const defaultReminder: ReminderConfig = {
  enabled: true,
  intervalMinutes: 60,
  quietHours: [],
  timezone: 'Europe/Berlin',
  language: 'de',
};

function makeApiMock(
  getResult: ReminderConfig | null = defaultReminder
): Partial<UserConfigApiService> {
  return {
    getConfig: vi
      .fn()
      .mockReturnValue(
        of(getResult ? { userId: 'u1', reminder: getResult } : { userId: 'u1' })
      ),
    updateConfig: vi
      .fn()
      .mockReturnValue(of({ userId: 'u1', reminder: getResult ?? undefined })),
  };
}

function makePermissionMock(
  status: 'default' | 'granted' | 'denied' | 'unsupported' = 'granted'
): Partial<ReminderPermissionService> {
  return {
    status: signal(status),
    requestPermission: vi.fn().mockResolvedValue(status),
  };
}

describe('ReminderStore', () => {
  it('starts with null config and loading false', async () => {
    const { fixture } = await render('', {
      providers: [
        ReminderStore,
        { provide: UserConfigApiService, useValue: makeApiMock() },
        {
          provide: ReminderPermissionService,
          useValue: makePermissionMock(),
        },
      ],
    });
    const store = fixture.debugElement.injector.get(ReminderStore);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('loadConfig sets config from API response', async () => {
    const apiMock = makeApiMock(defaultReminder);
    const { fixture } = await render('', {
      providers: [
        ReminderStore,
        { provide: UserConfigApiService, useValue: apiMock },
        {
          provide: ReminderPermissionService,
          useValue: makePermissionMock(),
        },
      ],
    });
    const store = fixture.debugElement.injector.get(ReminderStore);

    await store.loadConfig('u1');

    expect(store.config()).toEqual(defaultReminder);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('loadConfig sets config to null when reminder is absent', async () => {
    const apiMock = makeApiMock(null);
    const { fixture } = await render('', {
      providers: [
        ReminderStore,
        { provide: UserConfigApiService, useValue: apiMock },
        {
          provide: ReminderPermissionService,
          useValue: makePermissionMock(),
        },
      ],
    });
    const store = fixture.debugElement.injector.get(ReminderStore);

    await store.loadConfig('u1');

    expect(store.config()).toBeNull();
  });

  it('saveConfig calls updateConfig and updates store state', async () => {
    const updated: ReminderConfig = {
      ...defaultReminder,
      intervalMinutes: 120,
    };
    const apiMock = makeApiMock(defaultReminder);
    (apiMock.updateConfig as any).mockReturnValue(
      of({ userId: 'u1', reminder: updated })
    );

    const { fixture } = await render('', {
      providers: [
        ReminderStore,
        { provide: UserConfigApiService, useValue: apiMock },
        {
          provide: ReminderPermissionService,
          useValue: makePermissionMock(),
        },
      ],
    });
    const store = fixture.debugElement.injector.get(ReminderStore);

    await store.saveConfig('u1', updated);

    expect(apiMock.updateConfig).toHaveBeenCalledWith('u1', {
      reminder: updated,
    });
    expect(store.config()).toEqual(updated);
  });

  it('resetConfig sets reminder to disabled defaults and saves', async () => {
    const apiMock = makeApiMock(defaultReminder);
    const { fixture } = await render('', {
      providers: [
        ReminderStore,
        { provide: UserConfigApiService, useValue: apiMock },
        {
          provide: ReminderPermissionService,
          useValue: makePermissionMock(),
        },
      ],
    });
    const store = fixture.debugElement.injector.get(ReminderStore);

    await store.resetConfig('u1');

    expect(apiMock.updateConfig).toHaveBeenCalled();
    const call = (apiMock.updateConfig as any).mock.calls[0];
    expect(call[1].reminder.enabled).toBe(false);
  });

  it('loadConfig sets error on API failure', async () => {
    const apiMock = {
      getConfig: vi
        .fn()
        .mockReturnValue(throwError(() => new Error('Network error'))),
      updateConfig: vi.fn(),
    };
    const { fixture } = await render('', {
      providers: [
        ReminderStore,
        { provide: UserConfigApiService, useValue: apiMock },
        {
          provide: ReminderPermissionService,
          useValue: makePermissionMock(),
        },
      ],
    });
    const store = fixture.debugElement.injector.get(ReminderStore);

    await store.loadConfig('u1');

    expect(store.error()).toBeInstanceOf(Error);
    expect(store.loading()).toBe(false);
  });

  it('exposes permissionStatus from ReminderPermissionService', async () => {
    const permissionMock = makePermissionMock('denied');
    const { fixture } = await render('', {
      providers: [
        ReminderStore,
        { provide: UserConfigApiService, useValue: makeApiMock() },
        { provide: ReminderPermissionService, useValue: permissionMock },
      ],
    });
    const store = fixture.debugElement.injector.get(ReminderStore);
    expect(store.permissionStatus()).toBe('denied');
  });
});
