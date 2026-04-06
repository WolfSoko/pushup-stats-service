import { LOCALE_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReminderStore } from './reminder.store';
import { ReminderPermissionService } from './reminder-permission.service';
import { MotivationStore } from '@pu-stats/motivation';
import { isInQuietHours, ReminderService } from './reminder.service';
import { PushSubscriptionStore } from './push/push-subscription.store';
import type { PushStatus } from './push/push-subscription.store';
import type { ReminderConfig } from '@pu-stats/models';

async function flushMicrotasks(): Promise<void> {
  // Several ticks to flush chained async operations
  // (SW ready → loadQuotes → showNotification)
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

// ── ReminderService.tick() – uses SW showNotification ────────────────────────

describe('ReminderService', () => {
  let showNotificationSpy: jest.Mock;

  // Save original property descriptors to restore after each test.
  // Using descriptors (not values) so we can delete the property when
  // it didn't originally exist, preventing false 'in' checks.
  const swDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'serviceWorker'
  );
  const notifDescriptor = Object.getOwnPropertyDescriptor(
    window,
    'Notification'
  );

  const defaultConfig: ReminderConfig = {
    enabled: true,
    intervalMinutes: 60,
    quietHours: [],
    timezone: 'UTC',
    language: 'de',
  };

  function createService(
    configOverride?: Partial<ReminderConfig>,
    pushStatus: PushStatus = 'not-subscribed',
    locale = 'de'
  ): ReminderService {
    const config = { ...defaultConfig, ...configOverride };
    TestBed.configureTestingModule({
      providers: [
        ReminderService,
        { provide: LOCALE_ID, useValue: locale },
        {
          provide: ReminderStore,
          useValue: { config: signal(config) },
        },
        {
          provide: ReminderPermissionService,
          useValue: { status: signal('granted') },
        },
        {
          provide: MotivationStore,
          useValue: {
            loadQuotes: jest.fn().mockResolvedValue(undefined),
            quotes: signal(['Stay strong!']),
          },
        },
        {
          provide: PushSubscriptionStore,
          useValue: { status: signal(pushStatus) },
        },
      ],
    });
    return TestBed.inject(ReminderService);
  }

  beforeEach(() => {
    jest.useFakeTimers();

    showNotificationSpy = jest.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: jest
          .fn()
          .mockResolvedValue({ showNotification: showNotificationSpy }),
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted' },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    // Restore original descriptors to prevent global state leaks.
    // Delete then re-define so 'prop in obj' checks stay accurate.
    if (swDescriptor) {
      Object.defineProperty(navigator, 'serviceWorker', swDescriptor);
    } else {
      delete (navigator as Record<string, unknown>)['serviceWorker'];
    }
    if (notifDescriptor) {
      Object.defineProperty(window, 'Notification', notifDescriptor);
    } else {
      delete (window as Record<string, unknown>)['Notification'];
    }
  });

  it('should use ServiceWorker showNotification instead of new Notification()', async () => {
    const service = createService();
    service.start({ userId: 'u1' });

    // Advance past the initial 5s delay
    jest.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(showNotificationSpy).toHaveBeenCalledWith(
      expect.stringContaining('Liegestütze'),
      expect.objectContaining({
        body: 'Stay strong!',
        tag: 'reminder',
        renotify: true,
      })
    );

    service.stop();
  });

  it('should NOT call new Notification() when SW is available (Android compatibility)', async () => {
    const notificationCtorSpy = jest.fn();
    Object.defineProperty(window, 'Notification', {
      value: Object.assign(notificationCtorSpy, { permission: 'granted' }),
      configurable: true,
      writable: true,
    });

    const service = createService();
    service.start({ userId: 'u1' });
    jest.advanceTimersByTime(5_000);
    await flushMicrotasks();

    // The constructor should never be called — only SW showNotification
    expect(notificationCtorSpy).not.toHaveBeenCalled();
    expect(showNotificationSpy).toHaveBeenCalled();

    service.stop();
  });

  it('should fall back to new Notification() when no SW registration exists', async () => {
    const notificationCtorSpy = jest.fn();
    Object.defineProperty(window, 'Notification', {
      value: Object.assign(notificationCtorSpy, { permission: 'granted' }),
      configurable: true,
      writable: true,
    });
    // No SW registration (e.g. dev mode)
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistration: jest.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });

    const service = createService();
    service.start({ userId: 'u1' });
    jest.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(notificationCtorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Liegestütze'),
      expect.objectContaining({ body: 'Stay strong!' })
    );
    expect(showNotificationSpy).not.toHaveBeenCalled();

    service.stop();
  });

  it('should fall back to new Notification() when SW showNotification rejects', async () => {
    const notificationCtorSpy = jest.fn();
    Object.defineProperty(window, 'Notification', {
      value: Object.assign(notificationCtorSpy, { permission: 'granted' }),
      configurable: true,
      writable: true,
    });
    // SW exists but showNotification fails
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistration: jest.fn().mockResolvedValue({
          showNotification: jest.fn().mockRejectedValue(new Error('SW error')),
        }),
      },
      configurable: true,
      writable: true,
    });

    const service = createService();
    service.start({ userId: 'u1' });
    jest.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(notificationCtorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Liegestütze'),
      expect.objectContaining({ body: 'Stay strong!' })
    );

    service.stop();
  });

  it('should resolve notification icon relative to document.baseURI', async () => {
    // Simulate a locale-prefixed base URI (e.g. /de/)
    const originalBaseURI = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'baseURI'
    );
    Object.defineProperty(document, 'baseURI', {
      value: 'http://localhost/de/',
      configurable: true,
    });

    const service = createService();
    service.start({ userId: 'u1' });
    jest.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(showNotificationSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        icon: 'http://localhost/de/assets/pushup-logo.svg',
      })
    );

    // Restore
    if (originalBaseURI) {
      Object.defineProperty(Document.prototype, 'baseURI', originalBaseURI);
    } else {
      delete (document as Record<string, unknown>)['baseURI'];
    }

    service.stop();
  });

  it('should include locale-prefixed url in notification data (Android navigation fix)', async () => {
    const service = createService(undefined, 'not-subscribed', 'de');
    service.start({ userId: 'u1' });
    jest.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(showNotificationSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        data: { url: '/de/app', locale: 'de' },
      })
    );

    service.stop();
  });

  it('should use en locale prefix in notification data when locale is en', async () => {
    const service = createService(undefined, 'not-subscribed', 'en');
    service.start({ userId: 'u1' });
    jest.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(showNotificationSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        data: { url: '/en/app', locale: 'en' },
      })
    );

    service.stop();
  });

  it('should normalize regional locale (en-US → en) in notification data', async () => {
    const service = createService(undefined, 'not-subscribed', 'en-US');
    service.start({ userId: 'u1' });
    jest.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(showNotificationSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        data: { url: '/en/app', locale: 'en' },
      })
    );

    service.stop();
  });

  it('should not show notification when push subscription is active', async () => {
    const service = createService(undefined, 'subscribed');
    service.start({ userId: 'u1' });
    jest.advanceTimersByTime(5_000);
    await flushMicrotasks();

    // Server-side push handles delivery — client-side must stay silent
    expect(showNotificationSpy).not.toHaveBeenCalled();

    service.stop();
  });

  it('should not show notification when in quiet hours', async () => {
    const service = createService({
      quietHours: [{ from: '00:00', to: '23:59' }],
    });
    service.start({ userId: 'u1' });
    jest.advanceTimersByTime(5_000);
    await flushMicrotasks();

    expect(showNotificationSpy).not.toHaveBeenCalled();

    service.stop();
  });
});

// ── isInQuietHours ───────────────────────────────────────────────────────────

describe('isInQuietHours', () => {
  // Helper: build a Date in a given timezone at a given local HH:MM
  function _dateAt(timezone: string, isoDate: string, hhmm: string): Date {
    return new Date(`${isoDate}T${hhmm}:00.000+00:00`);
  }

  it('returns false when quietHours is empty', () => {
    const now = new Date('2026-03-23T14:00:00Z');
    expect(isInQuietHours([], 'UTC', now)).toBe(false);
  });

  it('returns true during a simple overnight window (22:00–07:00)', () => {
    // 23:30 UTC should be inside [22:00, 07:00)
    const now = new Date('2026-03-23T23:30:00Z');
    expect(isInQuietHours([{ from: '22:00', to: '07:00' }], 'UTC', now)).toBe(
      true
    );
  });

  it('returns true early morning inside overnight window (01:00 UTC)', () => {
    const now = new Date('2026-03-23T01:00:00Z');
    expect(isInQuietHours([{ from: '22:00', to: '07:00' }], 'UTC', now)).toBe(
      true
    );
  });

  it('returns false outside overnight window (12:00 UTC)', () => {
    const now = new Date('2026-03-23T12:00:00Z');
    expect(isInQuietHours([{ from: '22:00', to: '07:00' }], 'UTC', now)).toBe(
      false
    );
  });

  it('returns false exactly at the end boundary (07:00 UTC)', () => {
    const now = new Date('2026-03-23T07:00:00Z');
    expect(isInQuietHours([{ from: '22:00', to: '07:00' }], 'UTC', now)).toBe(
      false
    );
  });

  it('returns true at exactly the start boundary (22:00 UTC)', () => {
    const now = new Date('2026-03-23T22:00:00Z');
    expect(isInQuietHours([{ from: '22:00', to: '07:00' }], 'UTC', now)).toBe(
      true
    );
  });

  it('returns true during a simple same-day window (12:00–13:00)', () => {
    const now = new Date('2026-03-23T12:30:00Z');
    expect(isInQuietHours([{ from: '12:00', to: '13:00' }], 'UTC', now)).toBe(
      true
    );
  });

  it('returns false before same-day window (11:59 UTC)', () => {
    const now = new Date('2026-03-23T11:59:00Z');
    expect(isInQuietHours([{ from: '12:00', to: '13:00' }], 'UTC', now)).toBe(
      false
    );
  });

  it('returns false after same-day window (13:01 UTC)', () => {
    const now = new Date('2026-03-23T13:01:00Z');
    expect(isInQuietHours([{ from: '12:00', to: '13:00' }], 'UTC', now)).toBe(
      false
    );
  });

  it('returns true when any one of multiple windows matches', () => {
    const now = new Date('2026-03-23T12:30:00Z');
    const quietHours = [
      { from: '22:00', to: '07:00' },
      { from: '12:00', to: '13:00' },
    ];
    expect(isInQuietHours(quietHours, 'UTC', now)).toBe(true);
  });

  it('returns false when none of multiple windows matches', () => {
    const now = new Date('2026-03-23T15:00:00Z');
    const quietHours = [
      { from: '22:00', to: '07:00' },
      { from: '12:00', to: '13:00' },
    ];
    expect(isInQuietHours(quietHours, 'UTC', now)).toBe(false);
  });

  it('uses the provided now parameter instead of current time', () => {
    // We pass a specific now – the result must be deterministic
    const pastNight = new Date('2026-01-01T23:00:00Z');
    expect(
      isInQuietHours([{ from: '22:00', to: '07:00' }], 'UTC', pastNight)
    ).toBe(true);
  });

  it('handles same from and to (always-quiet degenerate case)', () => {
    // from === to – treat as no quiet period (always active)
    const now = new Date('2026-03-23T10:00:00Z');
    expect(isInQuietHours([{ from: '10:00', to: '10:00' }], 'UTC', now)).toBe(
      false
    );
  });
});
