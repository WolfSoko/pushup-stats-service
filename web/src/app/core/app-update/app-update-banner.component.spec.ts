import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AppUpdateBannerComponent } from './app-update-banner.component';
import { AppUpdateStore } from './app-update.store';
import { PageReloadService } from './page-reload.service';
import { TestBed } from '@angular/core/testing';

describe('AppUpdateBannerComponent', () => {
  let reload: ReturnType<typeof vitest.fn>;

  async function setup(
    prepare: (store: InstanceType<typeof AppUpdateStore>) => void
  ) {
    reload = vitest.fn(() => new Promise<void>(() => undefined));
    const view = await render(AppUpdateBannerComponent, {
      providers: [{ provide: PageReloadService, useValue: { reload } }],
    });
    const store = TestBed.inject(AppUpdateStore);
    prepare(store);
    view.fixture.detectChanges();
    return { store, view };
  }

  it('should render nothing while the app is current', async () => {
    // given / when
    await setup(() => undefined);

    // then
    expect(screen.queryByTestId('app-update-banner')).toBeNull();
  });

  it('should announce a ready update with reload and later actions', async () => {
    // given / when
    await setup((store) => store.markReady());

    // then
    expect(screen.getByRole('status').textContent).toContain(
      'Eine neue Version ist verfügbar.'
    );
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Später' })).toBeTruthy();
  });

  it('should reload and show the button busy when "Neu laden" is clicked', async () => {
    // given
    await setup((store) => store.markReady());
    const button = screen.getByRole('button', { name: 'Neu laden' });

    // when
    await userEvent.click(button);

    // then
    expect(reload).toHaveBeenCalledWith();
    expect(button.getAttribute('aria-busy')).toBe('true');
  });

  it('should hide the banner when "Später" is clicked', async () => {
    // given
    const { store } = await setup((s) => s.markReady());

    // when
    await userEvent.click(screen.getByRole('button', { name: 'Später' }));

    // then
    expect(screen.queryByTestId('app-update-banner')).toBeNull();
    expect(store.updatePending()).toBe(true);
  });

  it('should offer no "Später" for a broken cache', async () => {
    // given / when
    await setup((store) => store.markUnrecoverable());

    // then
    expect(screen.getByRole('status').textContent).toContain(
      'App-Daten sind veraltet'
    );
    expect(screen.queryByRole('button', { name: 'Später' })).toBeNull();
  });
});
