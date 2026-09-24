import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthStore, UserContextService } from '@pu-auth/auth';
import { PushSubscriptionService, type PushStatus } from '@pu-push/push';
import {
  ReminderPermissionService,
  ReminderService,
  ReminderStore,
} from '@pu-reminders/reminders';
import { nextMacrotask } from '@pu-stats/testing';
import { render, screen } from '@testing-library/angular';
import { of } from 'rxjs';

import { UserConfigStore } from '../../core/user-config.store';
import { RemindersPageComponent } from './reminders-page.component';

describe('RemindersPageComponent', () => {
  async function setup(status: PushStatus = 'not-subscribed') {
    const pushService = {
      init: vi.fn().mockResolvedValue(undefined),
      status: signal<PushStatus>(status),
      deviceCount: signal(1),
      subscribe: vi.fn().mockResolvedValue(true),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    };
    const authStore = {
      isAuthenticated: signal(true),
      loading: signal(false),
      unsubscribeAllPushDevices: vi.fn().mockResolvedValue(true),
    };
    const dialog = { open: vi.fn(() => ({ afterClosed: () => of(true) })) };
    const { fixture } = await render(RemindersPageComponent, {
      providers: [
        { provide: PushSubscriptionService, useValue: pushService },
        { provide: AuthStore, useValue: authStore },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        {
          provide: ReminderStore,
          useValue: {
            permissionStatus: signal('granted'),
            config: signal(null),
            error: signal(null),
            saveConfig: vi.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ReminderPermissionService,
          useValue: { status: signal('granted'), requestPermission: vi.fn() },
        },
        {
          provide: ReminderService,
          useValue: { start: vi.fn(), stop: vi.fn() },
        },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => 'u1', userNameSafe: () => 'Wolf' },
        },
        {
          provide: UserConfigStore,
          useValue: { config: signal(null), updateConfig: vi.fn() },
        },
      ],
    });
    return { fixture, pushService, authStore, dialog };
  }

  it('should show the pressed push button busy until the subscription settles', async () => {
    // given — a subscription the browser has not answered yet
    let settle: (ok: boolean) => void = () => undefined;
    const { fixture, pushService } = await setup();
    pushService.subscribe.mockReturnValue(
      new Promise<boolean>((resolve) => {
        settle = resolve;
      })
    );

    // when
    screen.getByTestId('push-subscribe').click();
    fixture.detectChanges();

    // then
    const button = screen.getByTestId('push-subscribe') as HTMLButtonElement;
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(false);

    // when
    settle(true);
    await nextMacrotask();
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(button.getAttribute('aria-busy')).toBeNull();
  });

  it('should show only the unsubscribe button busy once it was pressed', async () => {
    // given
    const { fixture, pushService } = await setup('subscribed');
    pushService.unsubscribe.mockReturnValue(new Promise(() => undefined));

    // when
    screen.getByTestId('push-unsubscribe').click();
    fixture.detectChanges();

    // then
    expect(
      screen.getByTestId('push-unsubscribe').getAttribute('aria-busy')
    ).toBe('true');
  });

  it('should show the unsubscribe-all button busy around the callable, not the auth store flag', async () => {
    // given — the dialog confirms at once, the callable takes its time
    let settle: (ok: boolean) => void = () => undefined;
    const { fixture, authStore } = await setup();
    authStore.unsubscribeAllPushDevices.mockReturnValue(
      new Promise<boolean>((resolve) => {
        settle = resolve;
      })
    );

    // when
    screen.getByTestId('push-unsubscribe-all').click();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();

    // then
    const button = screen.getByTestId('push-unsubscribe-all');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(authStore.unsubscribeAllPushDevices).toHaveBeenCalled();

    // when
    settle(true);
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();

    // then
    expect(button.getAttribute('aria-busy')).toBeNull();
  });
});
