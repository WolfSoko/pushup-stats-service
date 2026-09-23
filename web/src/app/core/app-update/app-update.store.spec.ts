import { TestBed } from '@angular/core/testing';
import { AppUpdateStore } from './app-update.store';

describe('AppUpdateStore', () => {
  function setup() {
    TestBed.configureTestingModule({});
    return TestBed.inject(AppUpdateStore);
  }

  it('should start with no pending update and no banner', () => {
    // given / when
    const store = setup();

    // then
    expect(store.updatePending()).toBe(false);
    expect(store.bannerVisible()).toBe(false);
  });

  it('should show the banner once a version is ready', () => {
    // given
    const store = setup();

    // when
    store.markReady();

    // then
    expect(store.updatePending()).toBe(true);
    expect(store.bannerVisible()).toBe(true);
  });

  it('should hide the banner after dismiss but keep the update pending', () => {
    // given
    const store = setup();
    store.markReady();

    // when
    store.dismiss();

    // then
    expect(store.bannerVisible()).toBe(false);
    expect(store.updatePending()).toBe(true);
  });

  it('should show the banner again when a newer version becomes ready after dismiss', () => {
    // given
    const store = setup();
    store.markReady();
    store.dismiss();

    // when
    store.markReady();

    // then
    expect(store.bannerVisible()).toBe(true);
  });

  it('should ignore dismiss for an unrecoverable state', () => {
    // given
    const store = setup();
    store.markUnrecoverable();

    // when
    store.dismiss();

    // then
    expect(store.bannerVisible()).toBe(true);
  });

  it('should not downgrade an unrecoverable state to a ready one', () => {
    // given
    const store = setup();
    store.markUnrecoverable();

    // when
    store.markReady();

    // then
    expect(store.status()).toBe('unrecoverable');
  });

  it('should hide the banner while the current route blocks updates', () => {
    // given
    const store = setup();
    store.markUnrecoverable();

    // when
    store.setRouteBlocksUpdate(true);

    // then
    expect(store.bannerVisible()).toBe(false);
    expect(store.updatePending()).toBe(true);
  });
});
