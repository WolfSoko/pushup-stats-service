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
