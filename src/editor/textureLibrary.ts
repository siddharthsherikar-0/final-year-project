import {
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  SRGBColorSpace,
  Texture,
} from 'three';
import type { TextureSlotDef } from './materials';

/**
 * Texture loading lifecycle.
 *
 * ================================================================ LIFECYCLE ===
 * The load-bearing rule is: a material is never touched until its replacement
 * has DECODED. Everything else follows from that.
 *
 * Three's `TextureLoader.load` is not usable for this on its own: it returns a
 * Texture synchronously while the image is still in flight, and reports failure
 * only through a callback. Writing `material.map = texture` on the synchronous
 * return would therefore assign a texture whose image may never arrive - the
 * surface would silently lose its map and the old, working texture would already
 * have been released. So decoding is awaited FIRST, through `createImageBitmap`
 * (or an `Image` element where that is unavailable), and only a genuinely
 * decoded image is turned into a texture.
 *
 * Object URLs: an object URL exists only for as long as the decode needs it. The
 * decoded bitmap is what the texture holds afterwards, so the URL is revoked as
 * soon as decoding settles - on BOTH the success and the failure path. A URL
 * leaked per failed import is a real leak in a long editing session, and the
 * failure path is exactly where it is easiest to forget.
 *
 * Colour space is applied from the SLOT, never inferred: base colour and
 * emissive maps are sRGB, while normal / roughness / metalness / AO maps are
 * numeric data. sRGB-decoding a normal map visibly corrupts the lighting, so
 * this is derived centrally instead of left to each call site.
 * ============================================================================
 */

/** Formats a browser can decode into a GPU texture without a server round trip. */
export const SUPPORTED_TEXTURE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

/**
 * 16 MB. Large enough for a 4K albedo sheet, small enough that a user who
 * accidentally drags in a video cannot exhaust GPU memory.
 */
export const MAX_TEXTURE_BYTES = 16 * 1024 * 1024;

/**
 * 8192 px. Beyond this a single texture is larger than most mobile GPUs' maximum
 * texture size, so three would silently downscale or fail to upload.
 */
export const MAX_TEXTURE_DIMENSION = 8192;

export interface TextureCandidate {
  name?: string;
  size?: number;
  type?: string;
}

export interface TextureLoadSuccess {
  ok: true;
  texture: Texture;
  width: number;
  height: number;
}

export interface TextureLoadFailure {
  ok: false;
  error: string;
}

export type TextureLoadResult = TextureLoadSuccess | TextureLoadFailure;

/** Decoded image source acceptable to `new Texture(...)`. */
export type DecodedImage = ImageBitmap | HTMLImageElement | HTMLCanvasElement;

export type ObjectUrlFactory = (blob: Blob) => string;
export type ObjectUrlRevoker = (url: string) => void;

let createObjectUrl: ObjectUrlFactory | null = null;
let revokeObjectUrl: ObjectUrlRevoker | null = null;

/**
 * Installs object-URL functions.
 *
 * jsdom has no `URL.createObjectURL`, and a browser test harness may want to
 * observe them. Injecting keeps the decode pipeline testable without stubbing
 * the network.
 */
export function setObjectUrlFactory(factory: ObjectUrlFactory | null): void {
  createObjectUrl = factory;
}

export function setObjectUrlRevoker(revoker: ObjectUrlRevoker | null): void {
  revokeObjectUrl = revoker;
}

function defaultCreateObjectUrl(blob: Blob): string {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('Object URLs are not available in this environment');
  }
  return URL.createObjectURL(blob);
}

function defaultRevokeObjectUrl(url: string): void {
  if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') return;
  URL.revokeObjectURL(url);
}

function factory(): ObjectUrlFactory {
  return createObjectUrl ?? defaultCreateObjectUrl;
}

function revoker(): ObjectUrlRevoker {
  return revokeObjectUrl ?? defaultRevokeObjectUrl;
}

/**
 * Revokes a previously created object URL, tolerating anything.
 *
 * Exported so the working scene's disposal path revokes through the SAME
 * revoker the loader used, which keeps an injected test revoker authoritative
 * for both paths.
 */
export function releaseObjectUrl(url: string | null | undefined): void {
  if (!url) return;
  try {
    revoker()(url);
  } catch {
    // Nothing actionable: the URL dies with the document either way.
  }
}

/** Human-readable extension list, used in the picker's accept attribute. */
export const TEXTURE_ACCEPT_ATTRIBUTE = '.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp';

/**
 * Reports whether a file's declared type is one this editor can decode.
 *
 * Split from size checking because the two failures need different messages: a
 * wrong file type is a correctness problem, an oversized file is a resource
 * limit, and conflating them produces unhelpful advice.
 */
export function textureTypeError(file: TextureCandidate): string | null {
  const type = (file.type ?? '').toLowerCase();
  const name = (file.name ?? '').toLowerCase();

  const typeOk = (SUPPORTED_TEXTURE_MIME_TYPES as readonly string[]).includes(type);

  // The declared type is checked against the extension too. A `.txt` renamed to
  // `.png` still declares `text/plain` and is caught here; a file whose MIME is
  // missing entirely (some OS file managers omit it) is judged on its extension.
  if (type) {
    return typeOk ? null : `Unsupported image type: ${type}. Use PNG, JPEG or WebP.`;
  }
  return /\.(png|jpe?g|webp)$/.test(name) ? null : 'Unsupported file. Use PNG, JPEG or WebP.';
}

/**
 * Reports whether a file exceeds the size limit, or is empty.
 *
 * Returns null when the size is acceptable.
 */
export function textureSizeError(file: TextureCandidate): string | null {
  const size = file.size;
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    return 'That file is empty.';
  }
  if (size > MAX_TEXTURE_BYTES) {
    const limit = Math.round(MAX_TEXTURE_BYTES / (1024 * 1024));
    return `That image is too large (limit ${limit} MB).`;
  }
  return null;
}

/** Validates a candidate file before any resource is created. */
export function validateTextureFile(file: TextureCandidate): string | null {
  // Type first: an oversized GIF is the wrong file, and reporting "too large"
  // would send the user looking in the wrong place.
  return textureTypeError(file) ?? textureSizeError(file);
}

/** Maps a slot's declared colour space onto three's constant. */
export function colorSpaceFor(slot: Pick<TextureSlotDef, 'colorSpace'>): Texture['colorSpace'] {
  return slot.colorSpace === 'srgb' ? SRGBColorSpace : NoColorSpace;
}

/**
 * Applies the settings every editor-loaded texture needs.
 *
 * Mipmaps stay on with trilinear filtering: a texture used as a normal map
 * without mipmaps aliases badly at distance. Colour space comes from the slot.
 */
export function configureTexture(texture: Texture, slot: Pick<TextureSlotDef, 'colorSpace'>): void {
  texture.colorSpace = colorSpaceFor(slot);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
}

export type ImageDecoder = (file: File, url: string) => Promise<DecodedImage>;

/**
 * Decodes through `createImageBitmap` when available.
 *
 * This is the preferred path: it validates that the bytes really are an image
 * and gives back dimensions, both of which are needed before the texture is
 * built. The `Image` element fallback exists for environments without it, and
 * still validates - `decode()` rejects on undecodable data.
 */
const defaultDecoder: ImageDecoder = async (file, url) => {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }

  if (typeof Image === 'undefined') {
    throw new Error('This browser cannot decode images in the editor');
  }

  const image = new Image();
  image.src = url;
  // `decode()` rejects for a corrupt file, which is exactly the validation
  // needed - a load event alone would not distinguish a slow fetch from a
  // broken image.
  if (typeof image.decode === 'function') await image.decode();
  else await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('decode failed'));
  });
  return image;
};

let decoder: ImageDecoder = defaultDecoder;

/** Replaces the image decoder. Test seam; production uses the browser's. */
export function setImageDecoder(next: ImageDecoder | null): void {
  decoder = next ?? defaultDecoder;
}

function dimensionsOf(image: DecodedImage): { width: number; height: number } {
  const candidate = image as { width?: unknown; height?: unknown; naturalWidth?: unknown; naturalHeight?: unknown };
  const width = typeof candidate.width === 'number' ? candidate.width : candidate.naturalWidth;
  const height = typeof candidate.height === 'number' ? candidate.height : candidate.naturalHeight;
  if (typeof width !== 'number' || typeof height !== 'number' || width <= 0 || height <= 0) {
    throw new Error('That file did not decode to a usable image');
  }
  return { width, height };
}

/**
 * Loads and validates a texture from a browser File.
 *
 * Never throws: failures come back as `{ ok: false }` with a message fit for the
 * status bar, because every caller is UI code that must leave the existing
 * material intact rather than propagate an exception.
 *
 * The returned texture is guaranteed to hold a DECODED image, so a caller can
 * assign it immediately and release the previous texture with confidence.
 */
export async function loadTextureFromFile(
  file: File,
  slot: Pick<TextureSlotDef, 'colorSpace'>,
  customDecoder?: ImageDecoder,
): Promise<TextureLoadResult> {
  const invalid = validateTextureFile(file);
  if (invalid) return { ok: false, error: invalid };

  let objectUrl: string;
  try {
    objectUrl = factory()(file);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not read that file',
    };
  }

  // The URL exists only for the decode. A `finally` guarantees exactly one
  // release on every path - success, decode failure, or a thrown decoder -
  // because the texture holds decoded pixels, never the URL.
  let image: DecodedImage;
  try {
    image = await (customDecoder ?? decoder)(file, objectUrl);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message
          ? `Could not decode that image: ${error.message}`
          : 'That file could not be decoded as an image.',
    };
  } finally {
    releaseObjectUrl(objectUrl);
  }

  let size: { width: number; height: number };
  try {
    size = dimensionsOf(image);
  } catch (error) {
    // A decoded object of unknown size is not uploadable; release it.
    if (typeof (image as ImageBitmap).close === 'function') (image as ImageBitmap).close();
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'That image has no usable dimensions',
    };
  }

  if (size.width > MAX_TEXTURE_DIMENSION || size.height > MAX_TEXTURE_DIMENSION) {
    if (typeof (image as ImageBitmap).close === 'function') (image as ImageBitmap).close();
    return {
      ok: false,
      error: `That image is ${size.width}x${size.height}; the limit is ${MAX_TEXTURE_DIMENSION}px per side.`,
    };
  }

  const texture = new Texture(image);
  texture.name = file.name?.trim() || 'Texture';
  configureTexture(texture, slot);

  return { ok: true, texture, width: size.width, height: size.height };
}
