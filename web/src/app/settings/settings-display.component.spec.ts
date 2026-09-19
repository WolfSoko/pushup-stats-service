import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { SettingsFacade } from '../stats/shell/settings.facade';
import { SettingsDisplayComponent } from './settings-display.component';

function facadeMock(overrides: Record<string, unknown> = {}) {
  return {
    snapQualityDraft: signal('low'),
    cheerAnimationEnabledDraft: signal(true),
    ...overrides,
  };
}

async function setup(overrides: Record<string, unknown> = {}) {
  return render(SettingsDisplayComponent, {
    providers: [{ provide: SettingsFacade, useValue: facadeMock(overrides) }],
  });
}

describe('SettingsDisplayComponent', () => {
  it('should reflect the cheer animation setting as checked when enabled', async () => {
    // given
    await setup({ cheerAnimationEnabledDraft: signal(true) });

    // then
    const toggle = screen.getByTestId('settings-cheer-animation');
    expect(toggle.querySelector('button')?.getAttribute('aria-checked')).toBe(
      'true'
    );
  });

  it('should reflect the cheer animation setting as unchecked when disabled', async () => {
    // given
    await setup({ cheerAnimationEnabledDraft: signal(false) });

    // then
    const toggle = screen.getByTestId('settings-cheer-animation');
    expect(toggle.querySelector('button')?.getAttribute('aria-checked')).toBe(
      'false'
    );
  });

  it('should update the draft when the cheer animation toggle is clicked', async () => {
    // given
    const cheerAnimationEnabledDraft = signal(false);
    await setup({ cheerAnimationEnabledDraft });
    const user = userEvent.setup();
    const button = screen
      .getByTestId('settings-cheer-animation')
      .querySelector('button') as HTMLButtonElement;

    // when
    await user.click(button);

    // then
    expect(cheerAnimationEnabledDraft()).toBe(true);
  });
});
