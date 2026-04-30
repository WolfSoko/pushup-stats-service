import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ShareService, type SharePayload } from './share.service';

interface MutableNavigator {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText: (text: string) => Promise<void> };
}

function setNavigator(stub: MutableNavigator | null): void {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: stub as unknown as Navigator,
  });
}

describe('ShareService', () => {
  const snackBarMock = { open: vitest.fn() };
  let originalNavigator: PropertyDescriptor | undefined;

  function setup(platform: 'browser' | 'server' = 'browser'): ShareService {
    vitest.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ShareService,
        { provide: MatSnackBar, useValue: snackBarMock },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
    return TestBed.inject(ShareService);
  }

  const payload: SharePayload = {
    title: 'Pushup Tracker',
    text: 'Heute schon 100 Liegestütze!',
    url: 'https://pushup-stats.de',
  };

  beforeAll(() => {
    originalNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator'
    );
  });

  afterAll(() => {
    if (originalNavigator) {
      Object.defineProperty(globalThis, 'navigator', originalNavigator);
    }
  });

  describe('Given the platform is the server', () => {
    it('Then share() returns "unavailable" without touching navigator', async () => {
      const service = setup('server');

      const result = await service.share(payload);

      expect(result).toBe('unavailable');
      expect(snackBarMock.open).not.toHaveBeenCalled();
    });
  });

  describe('Given the Web Share API is available and accepts the payload', () => {
    it('Then share() invokes navigator.share and returns "native"', async () => {
      const shareSpy = vitest.fn().mockResolvedValue(undefined);
      setNavigator({ share: shareSpy, canShare: () => true });
      const service = setup();

      const result = await service.share(payload);

      expect(shareSpy).toHaveBeenCalledTimes(1);
      expect(shareSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: payload.title,
          text: payload.text,
          url: payload.url,
        })
      );
      expect(result).toBe('native');
      // Native share UI handles its own confirmation — no snackbar.
      expect(snackBarMock.open).not.toHaveBeenCalled();
    });
  });

  describe('Given the user cancels the native share sheet', () => {
    it('Then share() returns "cancelled" and does NOT fall back to clipboard', async () => {
      const abort = new Error('User cancelled');
      abort.name = 'AbortError';
      const shareSpy = vitest.fn().mockRejectedValue(abort);
      const writeText = vitest.fn().mockResolvedValue(undefined);
      setNavigator({
        share: shareSpy,
        canShare: () => true,
        clipboard: { writeText },
      });
      const service = setup();

      const result = await service.share(payload);

      expect(result).toBe('cancelled');
      expect(writeText).not.toHaveBeenCalled();
      expect(snackBarMock.open).not.toHaveBeenCalled();
    });
  });

  describe('Given navigator.canShare rejects the payload', () => {
    it('Then share() falls back to the clipboard', async () => {
      const shareSpy = vitest.fn().mockResolvedValue(undefined);
      const writeText = vitest.fn().mockResolvedValue(undefined);
      setNavigator({
        share: shareSpy,
        canShare: () => false,
        clipboard: { writeText },
      });
      const service = setup();

      const result = await service.share(payload);

      expect(shareSpy).not.toHaveBeenCalled();
      expect(writeText).toHaveBeenCalledWith(`${payload.text} ${payload.url}`);
      expect(result).toBe('clipboard');
      expect(snackBarMock.open).toHaveBeenCalledTimes(1);
      expect(snackBarMock.open.mock.calls[0][0]).toContain('Zwischenablage');
    });
  });

  describe('Given Web Share API is missing but clipboard is available', () => {
    it('Then share() copies "<text> <url>" and returns "clipboard"', async () => {
      const writeText = vitest.fn().mockResolvedValue(undefined);
      setNavigator({ clipboard: { writeText } });
      const service = setup();

      const result = await service.share(payload);

      expect(writeText).toHaveBeenCalledWith(`${payload.text} ${payload.url}`);
      expect(result).toBe('clipboard');
      expect(snackBarMock.open).toHaveBeenCalledTimes(1);
    });
  });

  describe('Given navigator.share throws a non-Abort error', () => {
    it('Then share() falls back to the clipboard', async () => {
      const shareSpy = vitest
        .fn()
        .mockRejectedValue(new Error('Permission denied'));
      const writeText = vitest.fn().mockResolvedValue(undefined);
      setNavigator({
        share: shareSpy,
        canShare: () => true,
        clipboard: { writeText },
      });
      const service = setup();

      const result = await service.share(payload);

      expect(result).toBe('clipboard');
      expect(writeText).toHaveBeenCalledTimes(1);
    });
  });

  describe('Given clipboard.writeText fails', () => {
    it('Then share() returns "unavailable" and surfaces an error snackbar', async () => {
      const writeText = vitest
        .fn()
        .mockRejectedValue(new Error('No clipboard'));
      setNavigator({ clipboard: { writeText } });
      const service = setup();

      const result = await service.share(payload);

      expect(result).toBe('unavailable');
      expect(snackBarMock.open).toHaveBeenCalledTimes(1);
      expect(snackBarMock.open.mock.calls[0][0]).toContain('nicht möglich');
    });
  });

  describe('Given neither Web Share API nor clipboard is available', () => {
    it('Then share() returns "unavailable" and surfaces an error snackbar', async () => {
      setNavigator({});
      const service = setup();

      const result = await service.share(payload);

      expect(result).toBe('unavailable');
      expect(snackBarMock.open).toHaveBeenCalledTimes(1);
    });
  });
});
