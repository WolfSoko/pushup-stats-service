import { vi } from 'vitest';

import {
  ACCEPTED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  prepareProfilePhoto,
} from './profile-photo';

function fileOf(type: string, size = 1024): File {
  const file = new File(['x'], 'photo', { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('prepareProfilePhoto', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('Given a file the bucket would reject anyway', () => {
    it.each([['application/pdf'], ['image/gif'], ['image/svg+xml']])(
      'should reject %s before touching the network',
      async (type) => {
        // then — storage.rules enforces the same list; failing here gives
        // the user a message instead of an opaque upload error
        expect(await prepareProfilePhoto(fileOf(type))).toEqual({
          rejected: 'type',
        });
      }
    );

    it('should reject an absurdly large original', async () => {
      // given — the downscale would still have to decode it first
      const file = fileOf('image/jpeg', MAX_PHOTO_BYTES * 9);

      // then
      expect(await prepareProfilePhoto(file)).toEqual({ rejected: 'size' });
    });
  });

  describe('Given an accepted type that does not decode', () => {
    it('should reject rather than upload a corrupt file', async () => {
      // given — a mislabelled or truncated file has a valid MIME type
      vi.stubGlobal(
        'createImageBitmap',
        vi.fn().mockRejectedValue(new Error('broken'))
      );

      // then
      expect(await prepareProfilePhoto(fileOf('image/jpeg'))).toEqual({
        rejected: 'decode',
      });
    });
  });

  it('should accept every type the storage rules allow', () => {
    // then — the two lists must not drift; a type accepted here but
    // rejected by the rules would fail only at upload time
    expect(ACCEPTED_PHOTO_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);
  });
});
