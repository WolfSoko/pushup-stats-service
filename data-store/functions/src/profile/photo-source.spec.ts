import { photoEndpointUrl, photoSource, planPhotoUrls } from './photo-source';

describe('photoSource', () => {
  const uploaded = { photoUpdatedAt: '2026-09-06T10:00:00.000Z' };
  const publicUi = { ui: { publicProfile: true } };

  describe('Given a public profile with an uploaded photo', () => {
    it('should use the cacheable endpoint', () => {
      // then — the endpoint serves everyone, so the URL can be shared
      // and cached; `photoUpdatedAt` is what busts that cache
      expect(photoSource({ ...uploaded, ...publicUi }, false)).toEqual({
        kind: 'endpoint',
        version: uploaded.photoUpdatedAt,
      });
    });

    it('should not change for the owner', () => {
      expect(photoSource({ ...uploaded, ...publicUi }, true)).toEqual({
        kind: 'endpoint',
        version: uploaded.photoUpdatedAt,
      });
    });
  });

  describe('Given a private profile with an uploaded photo', () => {
    it('should inline it for the owner', () => {
      // then — the endpoint answers 404 while the profile is private, and
      // it cannot recognise the owner because an <img> sends no token;
      // pointing them at it would show a placeholder on their own profile
      expect(photoSource({ ...uploaded }, true)).toEqual({ kind: 'inline' });
    });

    it('should give a stranger nothing', () => {
      // then — a private profile is not returned to strangers at all, but
      // the rule must hold here too rather than relying on the caller
      expect(photoSource({ ...uploaded }, false)).toEqual({ kind: 'none' });
    });

    it.each([[{ ui: { publicProfile: false } }], [{ ui: {} }], [{}]])(
      'should treat %j as private',
      (ui) => {
        expect(photoSource({ ...uploaded, ...ui }, false)).toEqual({
          kind: 'none',
        });
      }
    );
  });

  describe('Given the account picture is switched off', () => {
    const hidden = { ui: { publicProfile: true, hideAccountPhoto: true } };

    it('should publish nothing instead of the account picture', () => {
      // then — the account picture is a fallback the user never agreed
      // to publish, so switching it off has to reach the profile
      expect(photoSource(hidden, false)).toEqual({ kind: 'none' });
    });

    it('should hide it from the owner too', () => {
      // then — the owner's view of their own profile must match what
      // visitors get, or the switch looks like it did nothing
      expect(photoSource(hidden, true)).toEqual({ kind: 'none' });
    });

    it('should leave an uploaded photo alone', () => {
      // then — an upload was chosen deliberately; this switch is only
      // about the picture that came from the identity provider
      expect(
        photoSource(
          { ...hidden, photoUpdatedAt: uploaded.photoUpdatedAt },
          false
        )
      ).toEqual({ kind: 'endpoint', version: uploaded.photoUpdatedAt });
    });

    it.each([[false], [undefined]])(
      'should keep the account picture when the switch is %s',
      (hideAccountPhoto) => {
        // then — absent means every existing profile keeps what it shows
        expect(
          photoSource({ ui: { publicProfile: true, hideAccountPhoto } }, false)
        ).toEqual({ kind: 'account' });
      }
    );
  });

  describe('Given no uploaded photo', () => {
    it.each([[undefined], [null], [{}], [{ photoUpdatedAt: '' }]])(
      'should fall back to the account picture for %j',
      (config) => {
        expect(photoSource(config, false)).toEqual({ kind: 'account' });
      }
    );

    it('should fall back even on a public profile', () => {
      expect(photoSource({ ...publicUi }, false)).toEqual({ kind: 'account' });
    });
  });
});

describe('photoEndpointUrl', () => {
  it('should carry the upload timestamp so a new photo is a new URL', () => {
    // given / when
    const url = photoEndpointUrl('u1', '2026-09-06T10:00:00.000Z');

    // then
    expect(url).toContain('/profilePhoto?uid=u1&v=');
    expect(url).toContain(encodeURIComponent('2026-09-06T10:00:00.000Z'));
  });
});

describe('planPhotoUrls', () => {
  const uploaded = { photoUpdatedAt: '2026-09-06T10:00:00.000Z' };
  const publicUi = { ui: { publicProfile: true } };

  it('should resolve a public upload without asking Auth', () => {
    // given / when
    const plan = planPhotoUrls(new Map([['u1', { ...uploaded, ...publicUi }]]));

    // then
    expect(plan.fromAccount).toEqual([]);
    expect(plan.urls.get('u1')).toContain('uid=u1');
  });

  it('should collect the users whose picture Auth has to answer for', () => {
    // given — no upload, so the Google account picture applies
    const plan = planPhotoUrls(
      new Map([
        ['u1', {}],
        ['u2', { ui: { hideAccountPhoto: true } }],
      ])
    );

    // then — one lookup, and none for the user who switched it off
    expect(plan.fromAccount).toEqual(['u1']);
    expect(plan.urls.size).toBe(0);
  });

  it('should skip a user whose config document is gone', () => {
    // given / when — `buildPublicProfile` returns not-found without a
    // config, so a half-deleted account must not surface a picture here
    const plan = planPhotoUrls(new Map([['u1', undefined]]));

    // then
    expect(plan.urls.size).toBe(0);
    expect(plan.fromAccount).toEqual([]);
  });

  it('should give a friend nothing for a private upload', () => {
    // given / when — the endpoint would 404, and an <img> cannot prove
    // who is asking
    const plan = planPhotoUrls(new Map([['u1', { ...uploaded }]]));

    // then
    expect(plan.urls.size).toBe(0);
    expect(plan.fromAccount).toEqual([]);
  });
});
