import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { LOCALE_ID, signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { XpStore } from '@pu-stats/data-access-state';
import { xpForEntry, xpRateFor, type XpConfig } from '@pu-stats/models';
import { XpPreviewComponent } from './xp-preview.component';

registerLocaleData(localeDe);

function storeStub(config: XpConfig | null = null) {
  const configSig = signal(config);
  return {
    config: configSig,
    previewXp: (entry: Parameters<typeof xpForEntry>[0]) =>
      xpForEntry(entry, xpRateFor(entry.exerciseId, configSig())),
  };
}

async function setup(
  inputs: Record<string, unknown>,
  config: XpConfig | null = null
) {
  return render(XpPreviewComponent, {
    inputs,
    providers: [
      { provide: XpStore, useValue: storeStub(config) },
      { provide: LOCALE_ID, useValue: 'de' },
    ],
  });
}

describe('XpPreviewComponent', () => {
  it('should show the XP an entry is worth with the rate', async () => {
    // given / when
    await setup({ exerciseId: 'pull.pullups', reps: 10 });

    // then
    const preview = screen.getByTestId('xp-preview');
    expect(preview.textContent).toContain('≈ 30 XP');
    expect(preview.textContent).toContain('3 XP / Wdh.');
  });

  it('should use the admin override', async () => {
    // given / when
    await setup(
      { exerciseId: 'plank.standard', durationSec: 120 },
      { rates: { 'plank.standard': 10 } }
    );

    // then
    expect(screen.getByTestId('xp-preview').textContent).toContain('≈ 20 XP');
  });

  it('should stay hidden while the entry is worth nothing', async () => {
    // given / when
    await setup({ exerciseId: 'pushup', reps: 0 });

    // then
    expect(screen.queryByTestId('xp-preview')).toBeNull();
  });
});
