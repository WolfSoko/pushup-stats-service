import { computed, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { vi } from 'vitest';

import { UserContextService } from '@pu-auth/auth';

import { AvatarService } from '../core/avatar.service';

import { SettingsFacade } from '../stats/shell/settings.facade';
import { ProfilePhotoService } from '../core/profile-photo.service';
import { SettingsProfileComponent } from './settings-profile.component';

function facadeMock(overrides: Record<string, unknown> = {}) {
  return {
    displayNameDraft: signal('Wolfi'),
    displayNameViolation: signal(null),
    leaderboardOptOutDraft: signal(false),
    publicProfileDraft: signal(true),
    hideAccountPhotoDraft: signal(false),
    profileUrl: signal('https://pushup-stats.com/de/u/uid-1'),
    userId: signal('uid-1'),
    config: signal({ publicProfile: true }),
    asValue: (event: Event) => (event.target as HTMLInputElement).value,
    shareMyProfile: vi.fn(),
    ...overrides,
  };
}

async function setup(
  photos: Partial<Record<string, unknown>> = {},
  accountPhotoUrl: string | null = null,
  uploadedUrl: string | null = null,
  hideAccountPhoto = false
) {
  const photoService = {
    busy: signal(false),
    upload: vi.fn().mockResolvedValue({ ok: true }),
    remove: vi.fn().mockResolvedValue(undefined),
    ...photos,
  };
  const uploaded = signal(uploadedUrl);
  const account = signal(accountPhotoUrl);
  const view = await render(SettingsProfileComponent, {
    providers: [
      {
        provide: SettingsFacade,
        useValue: facadeMock({
          hideAccountPhotoDraft: signal(hideAccountPhoto),
        }),
      },
      { provide: ProfilePhotoService, useValue: photoService },
      { provide: UserContextService, useValue: { accountPhotoUrl: account } },
      {
        provide: AvatarService,
        useValue: {
          uploadedUrl: uploaded,
          avatarUrl: computed(() => uploaded() ?? account()),
        },
      },
    ],
  });
  return { view, photoService };
}

function previewSrc(): string | null {
  const img = screen.queryByTestId('settings-photo-preview');
  return img ? img.getAttribute('src') : null;
}

describe('SettingsProfileComponent', () => {
  it('should render the display-name field and the visibility toggles', async () => {
    // given — this tab had no test at all after the settings section was
    // split into routed children
    await setup();

    // then
    expect(screen.getByTestId('settings-public-profile-toggle')).toBeTruthy();
    expect(screen.getByTestId('settings-leaderboard-toggle')).toBeTruthy();
  });

  describe('Profile photo', () => {
    it('should always state who can see the photo', async () => {
      // given — uploading is open to everyone, so the consequence has to
      // be visible at the moment of uploading, not buried in a policy
      await setup();

      // then
      const hint = screen.getByTestId('settings-photo-visibility-hint');
      expect(hint.textContent).toContain('jeder');
    });

    it('should show the placeholder when no photo is set', async () => {
      // given
      await setup();

      // then
      expect(screen.queryByTestId('settings-photo-preview')).toBeNull();
    });

    it('should preview an existing photo', async () => {
      // given
      await setup({}, null, 'https://example.test/a.jpg');

      // then
      expect(screen.getByTestId('settings-photo-preview')).toBeTruthy();
    });

    describe('Given the account picture is switched off', () => {
      it('should drop it from the preview', async () => {
        // given — the card shows what the profile publishes, so a preview
        // that ignored the switch would promise a picture that is gone
        await setup({}, 'https://lh3.googleusercontent.com/a/pic', null, true);

        // then
        expect(previewSrc()).toBeNull();
      });

      it('should stop claiming the account picture is in use', async () => {
        // given
        await setup({}, 'https://lh3.googleusercontent.com/a/pic', null, true);

        // then
        expect(screen.queryByTestId('settings-photo-account-hint')).toBeNull();
      });

      it('should keep an uploaded photo', async () => {
        // given — the switch is about the provider's picture only
        await setup(
          {},
          'https://lh3.googleusercontent.com/a/pic',
          'https://example.test/own',
          true
        );

        // then
        expect(previewSrc()).toBe('https://example.test/own');
      });

      it('should offer the switch even before anything is uploaded', async () => {
        // given
        await setup();

        // then
        expect(
          screen.getByTestId('settings-account-photo-toggle')
        ).toBeTruthy();
      });
    });

    it('should offer removal only once a photo exists', async () => {
      // given
      await setup();

      // then
      expect(screen.queryByTestId('settings-photo-remove')).toBeNull();
    });

    describe('Given a Google account picture and no upload', () => {
      it('should preview the account picture', async () => {
        // given — the profile already falls back to it, so a page that
        // shows the empty placeholder here contradicts the live profile
        await setup({}, 'https://lh3.googleusercontent.com/a/pic');

        // then
        expect(previewSrc()).toBe('https://lh3.googleusercontent.com/a/pic');
      });

      it('should not offer to remove it', async () => {
        // given — it belongs to the Google account; this page cannot
        // delete it, and a button that does nothing is worse than none
        await setup({}, 'https://lh3.googleusercontent.com/a/pic');

        // then
        expect(screen.queryByTestId('settings-photo-remove')).toBeNull();
      });

      it('should say where the picture comes from', async () => {
        // given — otherwise the missing remove button looks broken
        await setup({}, 'https://lh3.googleusercontent.com/a/pic');

        // then
        expect(
          screen.getByTestId('settings-photo-account-hint').textContent
        ).toContain('Google');
      });
    });

    describe('Given both an upload and a Google account picture', () => {
      it('should prefer the upload', async () => {
        // given
        await setup(
          {},
          'https://lh3.googleusercontent.com/a/pic',
          'https://example.test/own'
        );

        // then
        expect(previewSrc()).toBe('https://example.test/own');
      });

      it('should offer to remove the upload', async () => {
        // given
        await setup(
          {},
          'https://lh3.googleusercontent.com/a/pic',
          'https://example.test/own'
        );

        // then
        expect(screen.getByTestId('settings-photo-remove')).toBeTruthy();
      });

      it('should not claim the account picture is in use', async () => {
        // given
        await setup(
          {},
          'https://lh3.googleusercontent.com/a/pic',
          'https://example.test/own'
        );

        // then
        expect(screen.queryByTestId('settings-photo-account-hint')).toBeNull();
      });
    });

    it('should surface a rejection instead of failing silently', async () => {
      // given
      const { view, photoService } = await setup({
        upload: vi.fn().mockResolvedValue({ ok: false, reason: 'type' }),
      });
      const input = screen.getByTestId(
        'settings-photo-input'
      ) as HTMLInputElement;
      const file = new File(['x'], 'a.gif', { type: 'image/gif' });
      Object.defineProperty(input, 'files', { value: [file] });

      // when
      input.dispatchEvent(new Event('change'));
      await view.fixture.whenStable();
      view.fixture.detectChanges();

      // then
      expect(photoService.upload).toHaveBeenCalled();
      expect(screen.getByTestId('settings-photo-error')).toBeTruthy();
    });
  });
});
