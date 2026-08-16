/**
 * Downscale a documentation photo before upload so a save doesn't hang on
 * one bar of signal — a modern phone shoots 8–12MB HEIC/JPEG frames, and a
 * 2048px JPEG (~400–800KB) is plenty for identifying what was seen.
 *
 * Only used for sighting documentation photos. Camera-trap bulk uploads keep
 * their originals: those feed EXIF-timestamp parsing and ML inference, where
 * re-encoding would cost real information.
 *
 * Fails open: any decode/encode problem returns the original file unchanged.
 */

const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 0.82;
/** Files at or under this size aren't worth re-encoding. */
const SKIP_UNDER_BYTES = 1_000_000;

export async function downscalePhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= SKIP_UNDER_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    // Re-encoding can lose (a already-efficient file); keep whichever is smaller.
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** Downscale a batch, preserving order. */
export function downscalePhotos(files: File[]): Promise<File[]> {
  return Promise.all(files.map(downscalePhoto));
}
