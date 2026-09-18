import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FriendInviteService } from './friend-invite.service';

describe('FriendInviteService', () => {
  const TOKEN = 'Ab3-_ZzQ19xKpLmNoPqRsTuVwXyZ0123';

  function setup(
    platform: 'browser' | 'server' = 'browser'
  ): FriendInviteService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: platform }],
    });
    return TestBed.inject(FriendInviteService);
  }

  beforeEach(() => {
    localStorage.clear();
  });

  it('should keep the token from a shared link', () => {
    // given
    const service = setup();

    // when
    service.capture(`?ref=inviter-1&fi=${TOKEN}&utm_source=whatsapp`);

    // then
    expect(service.pending()).toBe(TOKEN);
  });

  it('should survive the navigation that drops the query string', () => {
    // given a visitor who followed an invite link
    setup().capture(`?fi=${TOKEN}`);

    // when the app reloads on a route without the parameter
    const afterReload = setup();

    // then the token is still waiting to be redeemed
    expect(afterReload.pending()).toBe(TOKEN);
  });

  it('should keep the first token when a second link arrives', () => {
    // given — the link that brought them in is the one that counts
    const service = setup();
    service.capture(`?fi=${TOKEN}`);

    // when
    service.capture('?fi=Zz9-_AbCdEfGhIjKlMnOpQrStUvWx012');

    // then
    expect(service.pending()).toBe(TOKEN);
  });

  it('should ignore anything that could not be a token', () => {
    // given — the value ends up in a document path on the server
    const service = setup();

    // when
    service.capture('?fi=has/slash-aaaaaaaaaaaaaaaaa');
    service.capture('?fi=tooshort');
    service.capture('?fi=');
    service.capture('?ref=inviter-1');

    // then
    expect(service.pending()).toBeNull();
  });

  it('should drop the token once it has been redeemed', () => {
    // given
    const service = setup();
    service.capture(`?fi=${TOKEN}`);

    // when
    service.clear();

    // then — and it stays gone across a reload
    expect(service.pending()).toBeNull();
    expect(setup().pending()).toBeNull();
  });

  it('should stay off storage on the server', () => {
    // given
    const service = setup('server');

    // when
    service.capture(`?fi=${TOKEN}`);

    // then
    expect(service.pending()).toBeNull();
  });
});
