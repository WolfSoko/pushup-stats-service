import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { UserContextService } from '@pu-auth/auth';
import { XpApiService } from '@pu-stats/data-access';
import { XpStore } from '@pu-stats/data-access-state';
import type { XpConfig } from '@pu-stats/models';
import { AdminXpRatesSectionComponent } from './admin-xp-rates-section.component';

async function setup() {
  const config = signal<XpConfig | null>(null);
  const configLoaded = signal(false);
  const config$ = {
    next(value: XpConfig | null) {
      config.set(value);
      configLoaded.set(true);
    },
  };
  const api = {
    saveConfig: vi.fn(async () => undefined),
  };
  const view = await render(AdminXpRatesSectionComponent, {
    providers: [
      { provide: XpApiService, useValue: api },
      { provide: XpStore, useValue: { config, configLoaded } },
      {
        provide: UserContextService,
        useValue: { userIdSafe: signal('admin-1') },
      },
    ],
  });
  return { ...view, api, config$ };
}

describe('AdminXpRatesSectionComponent', () => {
  it('should show a skeleton until the stored rates arrive', async () => {
    // given / when
    const { container } = await setup();

    // then
    expect(container.querySelector('pu-skeleton-table')).not.toBeNull();
    expect(screen.queryByTestId('xp-rates-save')).toBeNull();
  });

  it('should list the rate of every exercise per category', async () => {
    // given
    const { config$, fixture } = await setup();

    // when
    config$.next({ rates: { pushup: 2 } });
    fixture.detectChanges();

    // then
    const row = screen.getByTestId('xp-rate-row-pushup');
    expect(row.querySelector('input')?.value).toBe('2');
    expect(row.textContent).toContain('XP / Wdh.');
    expect(screen.getByTestId('xp-rates-core')).toBeTruthy();
  });

  it('should save an edited rate', async () => {
    // given
    const { config$, fixture, api } = await setup();
    config$.next(null);
    fixture.detectChanges();
    const input = screen
      .getByTestId('xp-rate-row-pull.pullups')
      .querySelector('input') as HTMLInputElement;

    // when
    input.value = '4';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    screen.getByTestId('xp-rates-save').click();
    await fixture.whenStable();

    // then
    expect(api.saveConfig).toHaveBeenCalledWith(
      { 'pull.pullups': 4 },
      'admin-1'
    );
  });
});
