import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { XpStore } from '@pu-stats/data-access-state';
import { levelProgress } from '@pu-stats/models';
import { render, screen } from '@testing-library/angular';

import { LevelCardComponent } from './level-card.component';

async function setup(opts: { loaded: boolean; totalXp: number }) {
  await render(LevelCardComponent, {
    providers: [
      provideRouter([]),
      {
        provide: XpStore,
        useValue: {
          loaded: signal(opts.loaded).asReadonly(),
          progress: signal(levelProgress(opts.totalXp)).asReadonly(),
        },
      },
    ],
  });
}

describe('LevelCardComponent', () => {
  it('should show the level and the XP still missing', async () => {
    // given 200 XP: level 2, 100 of 200 into it
    await setup({ loaded: true, totalXp: 200 });

    // then
    expect(screen.getByText('Level 2')).toBeTruthy();
    expect(screen.getByText(/Noch 100 XP bis Level\s+3/)).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '50'
    );
  });

  it('should link to the badge collection', async () => {
    // given
    await setup({ loaded: true, totalXp: 0 });

    // then
    expect(
      screen.getByTestId('dashboard-level-card').getAttribute('href')
    ).toBe('/abzeichen');
  });

  it('should render a skeleton until the XP state has loaded', async () => {
    // given
    await setup({ loaded: false, totalXp: 0 });

    // then
    expect(screen.queryByText(/Level/)).toBeNull();
    expect(
      screen.getByTestId('dashboard-level-card').getAttribute('aria-busy')
    ).toBe('true');
  });
});
