import { TestBed } from '@angular/core/testing';
import { Storage } from '@angular/fire/storage';
import { UserContextService } from '@pu-auth/auth';
import { PendingRequestsService } from '@pu-stats/data-access';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProfilePhotoService } from './profile-photo.service';
import { UserConfigStore } from './user-config.store';

const override = (
  service: ProfilePhotoService,
  key: string,
  value: unknown
): void => {
  Object.defineProperty(service, key, { value, writable: true });
};

describe('ProfilePhotoService', () => {
  let service: ProfilePhotoService;
  let pending: PendingRequestsService;
  let save: ReturnType<typeof vi.fn>;
  let uploadBytesFn: ReturnType<typeof vi.fn>;
  let deleteObjectFn: ReturnType<typeof vi.fn>;
  let prepareFn: ReturnType<typeof vi.fn>;

  const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' });

  const setup = (opts: { storage?: unknown; uid?: string } = {}): void => {
    save = vi.fn().mockResolvedValue(undefined);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Storage,
          useValue: 'storage' in opts ? opts.storage : {},
        },
        { provide: UserConfigStore, useValue: { save } },
        {
          provide: UserContextService,
          useValue: { userIdSafe: () => opts.uid ?? 'uid-1' },
        },
      ],
    });
    service = TestBed.inject(ProfilePhotoService);
    pending = TestBed.inject(PendingRequestsService);
    uploadBytesFn = vi.fn().mockResolvedValue(undefined);
    deleteObjectFn = vi.fn().mockResolvedValue(undefined);
    prepareFn = vi.fn().mockResolvedValue({ blob: new Blob(['jpeg']) });
    override(service, 'refFn', (_storage: unknown, path: string) => ({
      path,
    }));
    override(service, 'uploadBytesFn', uploadBytesFn);
    override(service, 'deleteObjectFn', deleteObjectFn);
    override(service, 'prepareFn', prepareFn);
  };

  beforeEach(() => {
    setup();
  });

  describe('upload', () => {
    it('should upload the prepared photo and stamp the config', async () => {
      // when
      const result = await service.upload(file);

      // then
      expect(result).toEqual({ ok: true });
      expect(uploadBytesFn).toHaveBeenCalledTimes(1);
      expect(uploadBytesFn.mock.calls[0][0]).toEqual({
        path: 'profile-photos/uid-1/avatar',
      });
      expect(uploadBytesFn.mock.calls[0][2]).toEqual({
        contentType: 'image/jpeg',
      });
      expect(save).toHaveBeenCalledWith({
        photoUpdatedAt: expect.any(String),
      });
      expect(service.busy()).toBe(false);
    });

    it('should count the upload as a pending request until it lands', async () => {
      // given
      let resolveUpload!: () => void;
      uploadBytesFn.mockReturnValue(
        new Promise<void>((resolve) => (resolveUpload = resolve))
      );

      // when
      const upload = service.upload(file);
      await vi.waitFor(() => expect(uploadBytesFn).toHaveBeenCalled());

      // then
      expect(pending.pending()).toBe(1);
      expect(service.busy()).toBe(true);

      // when
      resolveUpload();
      await upload;

      // then
      expect(pending.pending()).toBe(0);
      expect(service.busy()).toBe(false);
    });

    it('should pass a rejected image through without touching Storage', async () => {
      // given
      prepareFn.mockResolvedValue({ rejected: 'size' });

      // when
      const result = await service.upload(file);

      // then
      expect(result).toEqual({ ok: false, reason: 'size' });
      expect(uploadBytesFn).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });

    it('should report a failed upload and settle the pending count', async () => {
      // given
      uploadBytesFn.mockRejectedValue(new Error('offline'));

      // when
      const result = await service.upload(file);

      // then
      expect(result).toEqual({ ok: false, reason: 'upload' });
      expect(save).not.toHaveBeenCalled();
      expect(pending.pending()).toBe(0);
      expect(service.busy()).toBe(false);
    });

    it('should refuse without Storage or a user', async () => {
      // given
      setup({ storage: null });

      // when
      const result = await service.upload(file);

      // then
      expect(result).toEqual({ ok: false, reason: 'upload' });
      expect(prepareFn).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete the object, clear the marker and track the request', async () => {
      // given
      let resolveDelete!: () => void;
      deleteObjectFn.mockReturnValue(
        new Promise<void>((resolve) => (resolveDelete = resolve))
      );

      // when
      const removal = service.remove();

      // then
      expect(pending.pending()).toBe(1);

      // when
      resolveDelete();
      await removal;

      // then
      expect(deleteObjectFn).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith({ photoUpdatedAt: '' });
      expect(pending.pending()).toBe(0);
      expect(service.busy()).toBe(false);
    });

    it('should still clear the marker when the object is already gone', async () => {
      // given
      deleteObjectFn.mockRejectedValue(new Error('object-not-found'));

      // when
      await service.remove();

      // then
      expect(save).toHaveBeenCalledWith({ photoUpdatedAt: '' });
      expect(pending.pending()).toBe(0);
    });

    it('should do nothing without a user', async () => {
      // given
      setup({ uid: '' });

      // when
      await service.remove();

      // then
      expect(deleteObjectFn).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
    });
  });
});
