import { ApplicationRef, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Storage } from '@angular/fire/storage';
import { UserContextService } from '@pu-auth/auth';
import { vi } from 'vitest';

import { AvatarService, profilePhotoPath } from './avatar.service';
import { UserConfigStore } from './user-config.store';

// `spyOn` cannot redefine an ESM export; the module has to be mocked.
// `Object.assign` rather than a spread — the spread helper is not
// available inside a hoisted factory.
const { getDownloadURL, ref } = vi.hoisted(() => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
}));
vi.mock('@angular/fire/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@angular/fire/storage')>();
  return Object.assign({}, actual, { getDownloadURL, ref });
});

/**
 * Drives the resource to completion and waits for `until` to hold.
 *
 * Waiting on the condition rather than on a fixed number of turns: how
 * many flushes the loader needs is a scheduling detail, and pinning it to
 * one macrotask made this file lose its race whenever an unrelated spec
 * changed how Vitest packs files onto workers. Bounded, so a condition
 * that never holds fails as an assertion rather than hanging.
 */
async function settle(
  service: AvatarService,
  until: () => boolean = () => true
): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    service.avatarUrl();
    TestBed.tick();
    await new Promise((r) => setTimeout(r, 0));
    await TestBed.inject(ApplicationRef).whenStable();
    TestBed.tick();
    if (until()) return;
  }
}

/** The resource has produced its download URL. */
const uploadResolved = (service: AvatarService) => (): boolean =>
  service.uploadedUrl() !== null;

function setup(opts: {
  uid?: string;
  photoUpdatedAt?: string;
  accountPhotoUrl?: string | null;
  storage?: unknown;
}) {
  const config = signal<Record<string, unknown> | null>(
    opts.photoUpdatedAt === undefined
      ? null
      : { photoUpdatedAt: opts.photoUpdatedAt }
  );
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: Storage, useValue: opts.storage ?? {} },
      { provide: UserConfigStore, useValue: { config } },
      {
        provide: UserContextService,
        useValue: {
          userIdSafe: signal(opts.uid ?? 'uid-1'),
          accountPhotoUrl: signal(opts.accountPhotoUrl ?? null),
        },
      },
    ],
  });
  return { service: TestBed.inject(AvatarService), config };
}

describe('profilePhotoPath', () => {
  it('should be the single path both upload and read agree on', () => {
    // then — a second copy of this string is how an upload and a read
    // silently stop pointing at the same object
    expect(profilePhotoPath('uid-1')).toBe('profile-photos/uid-1/avatar');
  });
});

describe('AvatarService', () => {
  beforeEach(() => {
    getDownloadURL.mockReset();
    getDownloadURL.mockResolvedValue('https://own/pic');
    ref.mockReset();
    ref.mockImplementation((_storage: unknown, path: string) => ({ path }));
  });

  describe('Given no uploaded photo', () => {
    it('should not ask Storage at all', async () => {
      // given — without a version there is nothing to fetch, and asking
      // would be a guaranteed 404 on every page load
      const { service } = setup({ photoUpdatedAt: '' });

      // when
      await settle(service);

      // then
      expect(getDownloadURL).not.toHaveBeenCalled();
    });

    it('should fall back to the account picture', async () => {
      // given
      const { service } = setup({
        photoUpdatedAt: '',
        accountPhotoUrl: 'https://g/pic',
      });

      // when
      await settle(service);

      // then
      expect(service.avatarUrl()).toBe('https://g/pic');
    });

    it('should report nothing to remove', async () => {
      // given — the account picture belongs to the provider, not to us
      const { service } = setup({
        photoUpdatedAt: '',
        accountPhotoUrl: 'https://g/pic',
      });

      // when
      await settle(service);

      // then
      expect(service.uploadedUrl()).toBeNull();
    });
  });

  describe('Given an uploaded photo', () => {
    it('should prefer it over the account picture', async () => {
      // given
      const { service } = setup({
        photoUpdatedAt: '2026-09-06T10:00:00.000Z',
        accountPhotoUrl: 'https://g/pic',
      });

      // when
      await settle(service, uploadResolved(service));

      // then
      expect(service.avatarUrl()).toBe('https://own/pic');
      expect(service.uploadedUrl()).toBe('https://own/pic');
      expect(ref).toHaveBeenCalledWith(
        expect.anything(),
        'profile-photos/uid-1/avatar'
      );
    });

    it('should fall back to the account picture when the object is gone', async () => {
      // given — the config can name a photo that Storage no longer has
      getDownloadURL.mockRejectedValue(new Error('404'));
      const { service } = setup({
        photoUpdatedAt: '2026-09-06T10:00:00.000Z',
        accountPhotoUrl: 'https://g/pic',
      });

      // when
      await settle(service);

      // then
      expect(service.avatarUrl()).toBe('https://g/pic');
    });
  });

  describe('Given the signed-in user changes', () => {
    it('should not serve the previous user photo', async () => {
      // given — signing out must not leave the last avatar in the toolbar
      const { service } = setup({ uid: '', photoUpdatedAt: '' });

      // when
      await settle(service);

      // then
      expect(service.avatarUrl()).toBeNull();
    });
  });
});
