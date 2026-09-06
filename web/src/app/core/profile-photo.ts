export const MAX_PHOTO_EDGE = 512;
export const PHOTO_QUALITY = 0.82;
/** Matches the ceiling in `storage.rules`; the client should never reach it. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export type PhotoRejection = 'type' | 'size' | 'decode';

/**
 * Downscales a picked image to a square JPEG suitable for an avatar.
 *
 * Client-side on purpose: phone cameras produce 3–8 MB files, and the
 * profile renders the result at ~96 px. Uploading the original would cost
 * the user their data plan and the project its storage quota for pixels
 * nobody ever sees.
 *
 * Crops to a centred square rather than letterboxing — every surface that
 * shows the photo (profile header, user menu, OG card) is round or square.
 */
export async function prepareProfilePhoto(
  file: File
): Promise<{ blob: Blob } | { rejected: PhotoRejection }> {
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) return { rejected: 'type' };
  if (file.size > MAX_PHOTO_BYTES * 8) return { rejected: 'size' };

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // A file with an image MIME type that does not decode is either
    // corrupt or mislabelled; either way it must not reach the bucket.
    return { rejected: 'decode' };
  }

  const edge = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(edge, MAX_PHOTO_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return { rejected: 'decode' };
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    bitmap,
    (bitmap.width - edge) / 2,
    (bitmap.height - edge) / 2,
    edge,
    edge,
    0,
    0,
    size,
    size
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', PHOTO_QUALITY)
  );
  if (!blob) return { rejected: 'decode' };
  if (blob.size > MAX_PHOTO_BYTES) return { rejected: 'size' };
  return { blob };
}
