import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { LOCALE_ID, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { XpStore } from '@pu-stats/data-access-state';
import type { XpConfig } from '@pu-stats/models';
import { XpRateBadgeComponent } from './xp-rate-badge.component';

registerLocaleData(localeDe);

async function setup(exerciseId: string, config: XpConfig | null = null) {
  return render(XpRateBadgeComponent, {
    inputs: { exerciseId },
    providers: [
      { provide: XpStore, useValue: { config: signal(config) } },
      { provide: LOCALE_ID, useValue: 'de' },
    ],
  });
}

describe('XpRateBadgeComponent', () => {
  it('should show the default rate before the admin config is known', async () => {
    // given / when
    await setup('cardio.running');

    // then
    expect(screen.getByTestId('xp-rate-badge').textContent).toContain(
      '60 XP / km'
    );
  });

  it('should show the admin rate once configured', async () => {
    // given / when
    await setup('pushup', { rates: { pushup: 1.5 } });

    // then
    expect(screen.getByTestId('xp-rate-badge').textContent).toContain(
      '1,5 XP / Wdh.'
    );
  });

  it('should render nothing for an exercise without a rate unit', async () => {
    // given / when
    await setup('unknown.exercise');

    // then
    expect(screen.queryByTestId('xp-rate-badge')).toBeNull();
  });
});
