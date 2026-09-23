import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { vi } from 'vitest';

import { SettingsFacade } from '../stats/shell/settings.facade';
import { SettingsPrivacyComponent } from './settings-privacy.component';

async function setup(
  deletingAccount = signal(false),
  deleteAccountError = signal('')
) {
  const facade = {
    adsConsentDraft: signal(false),
    deletingAccount,
    deletePhraseInput: signal(''),
    deleteDialogError: signal<string | null>(null),
    deleteAccountError,
    asValue: (event: Event) => (event.target as HTMLInputElement).value,
    openDeleteDialog: vi.fn(),
    confirmDeleteFromDialog: vi.fn(),
  };
  const view = await render(SettingsPrivacyComponent, {
    providers: [{ provide: SettingsFacade, useValue: facade }],
  });
  return { view, facade };
}

describe('SettingsPrivacyComponent', () => {
  it('should open the confirmation dialog from the delete button', async () => {
    // given
    const { facade } = await setup();

    // when
    screen.getByTestId('settings-delete-account').click();

    // then
    expect(facade.openDeleteDialog).toHaveBeenCalled();
  });

  it('should mark the delete button busy while the account is being deleted', async () => {
    // given
    const deletingAccount = signal(false);
    const { view } = await setup(deletingAccount);
    const button = screen.getByTestId(
      'settings-delete-account'
    ) as HTMLButtonElement;

    // when
    deletingAccount.set(true);
    view.fixture.detectChanges();

    // then
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(false);
    expect(screen.getByText('Konto wird gelöscht…')).toBeTruthy();

    // when
    deletingAccount.set(false);
    view.fixture.detectChanges();

    // then
    expect(button.getAttribute('aria-busy')).toBeNull();
  });

  it('should show why the account could not be deleted', async () => {
    // given
    const deleteAccountError = signal('');
    const { view } = await setup(signal(false), deleteAccountError);
    expect(screen.queryByTestId('settings-delete-account-error')).toBeNull();

    // when
    deleteAccountError.set('Bitte ab- und wieder anmelden');
    view.fixture.detectChanges();

    // then
    expect(
      screen.getByTestId('settings-delete-account-error').textContent
    ).toContain('Bitte ab- und wieder anmelden');
  });

  it('should tell the user that all their data is deleted', async () => {
    // given / when
    await setup();

    // then
    expect(screen.getByText(/alle gespeicherten Daten/)).toBeTruthy();
  });
});
