import { render } from '@testing-library/angular';
import { ReminderPermissionService } from './reminder-permission.service';

function setNotification(
  supported: boolean,
  permission: NotificationPermission = 'default',
  requestFn?: () => Promise<NotificationPermission>
) {
  if (!supported) {
    Object.defineProperty(window, 'Notification', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  } else {
    Object.defineProperty(window, 'Notification', {
      value: {
        permission,
        requestPermission: requestFn ?? vi.fn().mockResolvedValue(permission),
      },
      configurable: true,
      writable: true,
    });
  }
}

describe('ReminderPermissionService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let originalNotification: any;

  beforeEach(() => {
    originalNotification = window.Notification;
  });

  afterEach(() => {
    Object.defineProperty(window, 'Notification', {
      value: originalNotification,
      configurable: true,
      writable: true,
    });
    vi.restoreAllMocks();
  });

  it('returns "unsupported" when Notification API is not available', async () => {
    setNotification(false);
    const { fixture } = await render('', {
      providers: [ReminderPermissionService],
    });
    const svc = fixture.debugElement.injector.get(ReminderPermissionService);
    expect(svc.status()).toBe('unsupported');
  });

  it('reads "granted" from Notification.permission on init', async () => {
    setNotification(true, 'granted');
    const { fixture } = await render('', {
      providers: [ReminderPermissionService],
    });
    const svc = fixture.debugElement.injector.get(ReminderPermissionService);
    expect(svc.status()).toBe('granted');
  });

  it('reads "denied" from Notification.permission on init', async () => {
    setNotification(true, 'denied');
    const { fixture } = await render('', {
      providers: [ReminderPermissionService],
    });
    const svc = fixture.debugElement.injector.get(ReminderPermissionService);
    expect(svc.status()).toBe('denied');
  });

  it('reads "default" from Notification.permission on init', async () => {
    setNotification(true, 'default');
    const { fixture } = await render('', {
      providers: [ReminderPermissionService],
    });
    const svc = fixture.debugElement.injector.get(ReminderPermissionService);
    expect(svc.status()).toBe('default');
  });

  it('updates status signal to "granted" after requestPermission resolves granted', async () => {
    const requestFn = vi.fn().mockResolvedValue('granted');
    setNotification(true, 'default', requestFn);
    const { fixture } = await render('', {
      providers: [ReminderPermissionService],
    });
    const svc = fixture.debugElement.injector.get(ReminderPermissionService);

    const result = await svc.requestPermission();
    expect(result).toBe('granted');
    expect(svc.status()).toBe('granted');
  });

  it('updates status signal to "denied" after requestPermission resolves denied', async () => {
    const requestFn = vi.fn().mockResolvedValue('denied');
    setNotification(true, 'default', requestFn);
    const { fixture } = await render('', {
      providers: [ReminderPermissionService],
    });
    const svc = fixture.debugElement.injector.get(ReminderPermissionService);

    const result = await svc.requestPermission();
    expect(result).toBe('denied');
    expect(svc.status()).toBe('denied');
  });

  it('returns "denied" immediately when unsupported', async () => {
    setNotification(false);
    const { fixture } = await render('', {
      providers: [ReminderPermissionService],
    });
    const svc = fixture.debugElement.injector.get(ReminderPermissionService);
    const result = await svc.requestPermission();
    expect(result).toBe('denied');
  });
});
