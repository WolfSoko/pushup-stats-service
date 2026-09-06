import { photoSource } from './photo-source';

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
