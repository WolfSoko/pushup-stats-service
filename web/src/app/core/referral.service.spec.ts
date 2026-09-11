import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ReferralService } from './referral.service';

describe('ReferralService', () => {
  function setup(platform: 'browser' | 'server' = 'browser'): ReferralService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platform }],
    });
    return TestBed.inject(ReferralService);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('should keep the inviter from a shared link', () => {
    // given
    const service = setup();

    // when
    service.capture('?ref=inviter-1&utm_source=whatsapp');

    // then
    expect(service.pending()).toBe('inviter-1');
  });

  it('should survive the navigation that drops the query string', () => {
    // given a visitor who followed an invite link
    setup().capture('?ref=inviter-1');

    // when the app reloads on a route without the parameter
    const afterReload = setup();

    // then the invitation is still waiting
    expect(afterReload.pending()).toBe('inviter-1');
  });

  it('should keep the first invitation when a second link arrives', () => {
    // given
    const service = setup();
    service.capture('?ref=inviter-1');

    // when
    service.capture('?ref=inviter-2');

    // then — the link that actually brought them in wins
    expect(service.pending()).toBe('inviter-1');
  });

  it('should ignore a ref that can never be a uid', () => {
    // given
    const service = setup();

    // when
    service.capture('?ref=');
    service.capture('?ref=a/b');
    service.capture('?other=inviter-1');

    // then
    expect(service.pending()).toBeNull();
  });

  it('should forget the invitation once it is claimed', () => {
    // given
    const service = setup();
    service.capture('?ref=inviter-1');

    // when
    service.clear();

    // then
    expect(service.pending()).toBeNull();
    expect(setup().pending()).toBeNull();
  });

  it('should do nothing on the server, where there is no visitor yet', () => {
    // given
    const service = setup('server');

    // when
    service.capture('?ref=inviter-1');

    // then
    expect(service.pending()).toBeNull();
  });
});
