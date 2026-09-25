import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { LOCALE_ID, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { XpStore } from '@pu-stats/data-access-state';
import { WikiDifficultyChipsComponent } from './wiki-difficulty-chips.component';

registerLocaleData(localeDe);

async function setup(inputs: Record<string, unknown>) {
  return render(WikiDifficultyChipsComponent, {
    inputs,
    providers: [
      { provide: XpStore, useValue: { config: signal(null) } },
      { provide: LOCALE_ID, useValue: 'de' },
    ],
  });
}

describe('WikiDifficultyChipsComponent', () => {
  it.each([
    ['beginner', 'Einsteiger'],
    ['intermediate', 'Mittelstufe'],
    ['advanced', 'Fortgeschritten'],
  ])('should label the %s difficulty', async (difficulty, label) => {
    // given / when
    const { container } = await setup({ difficulty });

    // then
    const chip = container.querySelector(`.difficulty-chip.${difficulty}`);
    expect(chip?.textContent?.trim()).toBe(label);
  });

  it('should show the XP rate of the exercise beside the difficulty', async () => {
    // given / when
    await setup({ difficulty: 'beginner', exerciseId: 'pull.pullups' });

    // then
    expect(screen.getByTestId('xp-rate-badge').textContent).toContain(
      '3 XP / Wdh.'
    );
  });

  it('should omit the XP rate without an exercise', async () => {
    // given / when
    await setup({ difficulty: 'advanced' });

    // then
    expect(screen.queryByTestId('xp-rate-badge')).toBeNull();
  });
});
