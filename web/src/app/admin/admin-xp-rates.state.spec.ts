import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UserContextService } from '@pu-auth/auth';
import { XpApiService } from '@pu-stats/data-access';
import { DEFAULT_XP_RATES, type XpConfig } from '@pu-stats/models';
import { BehaviorSubject } from 'rxjs';
import { AdminXpRatesState } from './admin-xp-rates.state';

function setup(initial: XpConfig | null = null) {
  const config$ = new BehaviorSubject<XpConfig | null>(initial);
  const api = {
    watchConfig: vi.fn(() => config$),
    saveConfig: vi.fn(async (rates: Record<string, number>) => {
      config$.next({ rates });
    }),
  };
  TestBed.configureTestingModule({
    providers: [
      AdminXpRatesState,
      { provide: XpApiService, useValue: api },
      {
        provide: UserContextService,
        useValue: { userIdSafe: signal('admin-1') },
      },
    ],
  });
  return { state: TestBed.inject(AdminXpRatesState), api, config$ };
}

describe('AdminXpRatesState', () => {
  it('should start from the stored overrides on top of the defaults', () => {
    // given / when
    const { state } = setup({ rates: { pushup: 2 } });

    // then
    expect(state.loaded()).toBe(true);
    expect(state.rateOf('pushup')).toBe(2);
    expect(state.rateOf('pull.pullups')).toBe(DEFAULT_XP_RATES['pull.pullups']);
    expect(state.dirty()).toBe(false);
  });

  it('should mark an edit dirty and save only the overrides', async () => {
    // given
    const { state, api } = setup();

    // when
    state.setRate('pull.pullups', '4');
    await state.save();

    // then
    expect(api.saveConfig).toHaveBeenCalledWith(
      { 'pull.pullups': 4 },
      'admin-1'
    );
    expect(state.dirty()).toBe(false);
    expect(state.saved()).toBe(true);
  });

  it('should drop an override when reset to the default', async () => {
    // given
    const { state, api } = setup({ rates: { pushup: 2 } });

    // when
    state.resetToDefault('pushup');
    await state.save();

    // then
    expect(state.isDefault('pushup')).toBe(true);
    expect(api.saveConfig).toHaveBeenCalledWith({}, 'admin-1');
  });

  it('should block saving while an input is invalid', async () => {
    // given
    const { state, api } = setup();

    // when
    state.setRate('pushup', '-3');
    await state.save();

    // then
    expect(state.invalid().has('pushup')).toBe(true);
    expect(api.saveConfig).not.toHaveBeenCalled();
  });

  it('should discard unsaved edits', () => {
    // given
    const { state } = setup();
    state.setRate('pushup', '5');

    // when
    state.discard();

    // then
    expect(state.dirty()).toBe(false);
    expect(state.rateOf('pushup')).toBe(DEFAULT_XP_RATES['pushup']);
  });

  it('should surface a failed save', async () => {
    // given
    const { state, api } = setup();
    api.saveConfig.mockRejectedValueOnce(new Error('permission-denied'));
    state.setRate('pushup', '5');

    // when
    await state.save();

    // then
    expect(state.error()).toContain('permission-denied');
    expect(state.dirty()).toBe(true);
  });
});
