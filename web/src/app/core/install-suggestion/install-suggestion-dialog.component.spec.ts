import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { InstallPromptService } from '../install-prompt.service';
import type { InstallSuggestionVariant } from './install-suggestion';
import { InstallSuggestionDialogComponent } from './install-suggestion-dialog.component';

describe('InstallSuggestionDialogComponent', () => {
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let installPrompt: {
    prompt: ReturnType<typeof vi.fn>;
    canInstall: ReturnType<typeof signal<boolean>>;
  };

  function setup(
    variant: InstallSuggestionVariant,
    promptOutcome = 'accepted',
    canInstall = false
  ): HTMLElement {
    dialogRef = { close: vi.fn() };
    installPrompt = {
      prompt: vi.fn().mockResolvedValue(promptOutcome),
      canInstall: signal(canInstall),
    };
    TestBed.configureTestingModule({
      imports: [InstallSuggestionDialogComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { variant } },
        { provide: InstallPromptService, useValue: installPrompt },
      ],
    });
    const fixture = TestBed.createComponent(InstallSuggestionDialogComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function byTestId(root: HTMLElement, id: string): HTMLElement {
    const element = root.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!element) throw new Error(`missing ${id}`);
    return element;
  }

  it('should link Android users to the Play Store listing', () => {
    // given
    const root = setup('play-store');
    // when
    const link = byTestId(root, 'install-suggestion-play-store');
    // then
    expect(link.getAttribute('href')).toContain(
      'play.google.com/store/apps/details?id=com.pushupstats.app'
    );
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('should close as "installing" when the Play Store link is tapped', () => {
    // given
    const root = setup('play-store');
    const link = byTestId(root, 'install-suggestion-play-store');
    link.addEventListener('click', (event) => event.preventDefault());
    // when
    link.click();
    // then
    expect(dialogRef.close).toHaveBeenCalledWith('installing');
  });

  it('should close as "dismissed" on "Nicht jetzt"', () => {
    // given
    const root = setup('play-store');
    // when
    byTestId(root, 'install-suggestion-dismiss').click();
    // then
    expect(dialogRef.close).toHaveBeenCalledWith('dismissed');
  });

  it('should open the browser install prompt and close as "installing" once accepted', async () => {
    // given
    const root = setup('pwa', 'accepted');
    // when
    byTestId(root, 'install-suggestion-install').click();
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());
    // then
    expect(installPrompt.prompt).toHaveBeenCalledTimes(1);
    expect(dialogRef.close).toHaveBeenCalledWith('installing');
  });

  it('should close as "dismissed" when the browser prompt is declined', async () => {
    // given
    const root = setup('pwa', 'dismissed');
    // when
    byTestId(root, 'install-suggestion-install').click();
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());
    // then
    expect(dialogRef.close).toHaveBeenCalledWith('dismissed');
  });

  it('should explain the Share → Home-Bildschirm steps on iOS', () => {
    // given
    const root = setup('ios');
    // when
    const text = root.textContent ?? '';
    // then
    expect(text).toContain('Zum Home-Bildschirm');
    expect(
      root.querySelector('[data-testid="install-suggestion-install"]')
    ).toBeNull();
  });

  it('should offer the browser install on Android when Chrome allows it', async () => {
    // given
    const root = setup('play-store', 'accepted', true);
    // when
    byTestId(root, 'install-suggestion-browser-install').click();
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());
    // then
    expect(installPrompt.prompt).toHaveBeenCalledTimes(1);
    expect(dialogRef.close).toHaveBeenCalledWith('installing');
  });

  it('should hide the browser install on Android when Chrome does not offer it', () => {
    // given
    const root = setup('play-store', 'accepted', false);
    // when
    const button = root.querySelector(
      '[data-testid="install-suggestion-browser-install"]'
    );
    // then
    expect(button).toBeNull();
  });
});
