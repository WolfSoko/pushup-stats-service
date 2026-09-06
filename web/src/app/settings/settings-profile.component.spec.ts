import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { vi } from 'vitest';

import { SettingsFacade } from '../stats/shell/settings.facade';
import { ProfilePhotoService } from './profile-photo.service';
import { SettingsProfileComponent } from './settings-profile.component';

function facadeMock(overrides: Record<string, unknown> = {}) {
  return {
    displayNameDraft: signal('Wolfi'),
    displayNameViolation: signal(null),
    leaderboardOptOutDraft: signal(false),
    publicProfileDraft: signal(true),
    profileUrl: signal('https://pushup-stats.com/de/u/uid-1'),
    userId: signal('uid-1'),
    config: signal({ publicProfile: true }),
    asValue: (event: Event) => (event.target as HTMLInputElement).value,
    shareMyProfile: vi.fn(),
    ...overrides,
  };
}

async function setup(photos: Partial<Record<string, unknown>> = {}) {
  const photoService = {
    busy: signal(false),
    upload: vi.fn().mockResolvedValue({ ok: true }),
    remove: vi.fn().mockResolvedValue(undefined),
    ownPhotoUrl: vi.fn().mockResolvedValue(null),
    ...photos,
  };
  const view = await render(SettingsProfileComponent, {
    providers: [
      { provide: SettingsFacade, useValue: facadeMock() },
      { provide: ProfilePhotoService, useValue: photoService },
    ],
  });
  return { view, photoService };
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
      await setup({
        ownPhotoUrl: vi.fn().mockResolvedValue('https://example.test/a.jpg'),
      });

      // then
      expect(screen.getByTestId('settings-photo-preview')).toBeTruthy();
    });

    it('should offer removal only once a photo exists', async () => {
      // given
      await setup();

      // then
      expect(screen.queryByTestId('settings-photo-remove')).toBeNull();
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
