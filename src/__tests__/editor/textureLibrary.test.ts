import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NoColorSpace, SRGBColorSpace, Texture } from 'three';
import {
  MAX_TEXTURE_BYTES,
  MAX_TEXTURE_DIMENSION,
  configureTexture,
  colorSpaceFor,
  loadTextureFromFile,
  releaseObjectUrl,
  setImageDecoder,
  setObjectUrlFactory,
  setObjectUrlRevoker,
  textureSizeError,
  textureTypeError,
  validateTextureFile,
  type DecodedImage,
} from '@/editor/textureLibrary';
import { TEXTURE_SLOT_BY_KEY } from '@/editor/materials';

/**
 * Texture loading lifecycle.
 *
 * The load-bearing guarantee is that a FAILED import never damages the material
 * it targeted, which follows from one rule: the image is decoded and validated
 * BEFORE any material is touched. These tests assert that ordering directly by
 * checking that a rejection path never yields a texture at all.
 *
 * jsdom can neither create object URLs nor decode images, so both are injected.
 * That is the same seam production uses, which keeps the tests honest about the
 * real call sequence.
 */

function fileLike(overrides: { name?: string; type?: string; size?: number } = {}): File {
  return {
    name: overrides.name ?? 'texture.png',
    type: overrides.type ?? 'image/png',
    size: overrides.size ?? 1024,
  } as unknown as File;
}

/** Stand-in for a decoded bitmap; only `width`/`height` are ever read. */
function fakeImage(width = 512, height = 256): DecodedImage {
  return { width, height } as unknown as DecodedImage;
}

describe('texture file validation', () => {
  it('accepts PNG, JPEG and WebP', () => {
    expect(validateTextureFile(fileLike({ name: 'a.png', type: 'image/png' }))).toBeNull();
    expect(validateTextureFile(fileLike({ name: 'a.jpg', type: 'image/jpeg' }))).toBeNull();
    expect(validateTextureFile(fileLike({ name: 'a.jpeg', type: 'image/jpeg' }))).toBeNull();
    expect(validateTextureFile(fileLike({ name: 'a.webp', type: 'image/webp' }))).toBeNull();
  });

  it('rejects an unsupported declared type with the type named', () => {
    const error = textureTypeError(fileLike({ name: 'a.tga', type: 'image/tga' }));
    expect(error).toMatch(/Unsupported image type: image\/tga/);
    expect(error).toMatch(/PNG, JPEG or WebP/);
  });

  it('rejects a renamed file whose declared type is wrong', () => {
    // The extension says PNG but the MIME says plain text: the MIME wins,
    // because that is what the browser will actually try to decode.
    expect(validateTextureFile(fileLike({ name: 'evil.png', type: 'text/plain' }))).toMatch(
      /Unsupported/,
    );
  });

  it('falls back to the extension when the MIME type is missing', () => {
    // Some OS file managers omit the type entirely; the extension is then the
    // only evidence available, so it is accepted.
    expect(validateTextureFile(fileLike({ name: 'shot.PNG', type: '' }))).toBeNull();
  });

  it('rejects an unknown extension with no MIME type', () => {
    expect(validateTextureFile(fileLike({ name: 'notes.txt', type: '' }))).toMatch(
      /Unsupported file/,
    );
  });

  it('rejects an empty file', () => {
    expect(textureSizeError(fileLike({ size: 0 }))).toMatch(/empty/i);
  });

  it('rejects a file over the size limit and states the limit', () => {
    const error = textureSizeError(fileLike({ size: MAX_TEXTURE_BYTES + 1 }));
    expect(error).toMatch(/too large/i);
    expect(error).toContain('16 MB');
  });

  it('accepts a file exactly at the limit', () => {
    expect(validateTextureFile(fileLike({ size: MAX_TEXTURE_BYTES }))).toBeNull();
  });

  it('reports type problems before size problems', () => {
    // Both are wrong; the message must point at the more fundamental one.
    const error = validateTextureFile(
      fileLike({ name: 'huge.gif', type: 'image/gif', size: MAX_TEXTURE_BYTES * 2 }),
    );
    expect(error).toMatch(/Unsupported image type/);
  });
});

describe('texture colour space', () => {
  it('marks colour maps sRGB and data maps linear', () => {
    expect(colorSpaceFor(TEXTURE_SLOT_BY_KEY.map)).toBe(SRGBColorSpace);
    expect(colorSpaceFor(TEXTURE_SLOT_BY_KEY.emissiveMap)).toBe(SRGBColorSpace);
    expect(colorSpaceFor(TEXTURE_SLOT_BY_KEY.normalMap)).toBe(NoColorSpace);
    expect(colorSpaceFor(TEXTURE_SLOT_BY_KEY.roughnessMap)).toBe(NoColorSpace);
    expect(colorSpaceFor(TEXTURE_SLOT_BY_KEY.metalnessMap)).toBe(NoColorSpace);
    expect(colorSpaceFor(TEXTURE_SLOT_BY_KEY.aoMap)).toBe(NoColorSpace);
  });

  it('applies the slot colour space when configuring a texture', () => {
    const colour = new Texture();
    configureTexture(colour, TEXTURE_SLOT_BY_KEY.map);
    expect(colour.colorSpace).toBe(SRGBColorSpace);

    const normal = new Texture();
    configureTexture(normal, TEXTURE_SLOT_BY_KEY.normalMap);
    // sRGB-decoding a normal map visibly corrupts the surface lighting.
    expect(normal.colorSpace).toBe(NoColorSpace);
  });

  it('enables mipmaps for correct minification', () => {
    const texture = new Texture();
    configureTexture(texture, TEXTURE_SLOT_BY_KEY.map);
    expect(texture.generateMipmaps).toBe(true);
  });
});

describe('texture loading', () => {
  let created: string[];
  let revoked: string[];
  let counter: number;

  beforeEach(() => {
    created = [];
    revoked = [];
    counter = 0;
    setObjectUrlFactory((blob) => {
      counter += 1;
      const url = `blob:test/${counter}/${(blob as File).name ?? 'blob'}`;
      created.push(url);
      return url;
    });
    setObjectUrlRevoker((url) => {
      revoked.push(url);
    });
    setImageDecoder(async () => fakeImage());
  });

  afterEach(() => {
    setObjectUrlFactory(null);
    setObjectUrlRevoker(null);
    setImageDecoder(null);
  });

  it('decodes, validates and returns a usable texture', async () => {
    const result = await loadTextureFromFile(
      fileLike({ name: 'albedo.png' }),
      TEXTURE_SLOT_BY_KEY.map,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.width).toBe(512);
    expect(result.height).toBe(256);
    expect(result.texture.isTexture).toBe(true);
    expect(result.texture.colorSpace).toBe(SRGBColorSpace);
    // Named after the file, so the inspector can label the slot.
    expect(result.texture.name).toBe('albedo.png');
  });

  it('revokes the object URL once the image is decoded', async () => {
    const result = await loadTextureFromFile(fileLike({ name: 'x.png' }), TEXTURE_SLOT_BY_KEY.map);

    expect(created).toHaveLength(1);
    // The texture holds decoded pixels, not the URL, so it is released at once.
    expect(revoked).toEqual(created);
    if (!result.ok) return;
    expect(result.texture.image).toBeTruthy();
  });

  it('rejects a corrupt image and yields no texture at all', async () => {
    setImageDecoder(async () => {
      throw new Error('The source image could not be decoded.');
    });

    const result = await loadTextureFromFile(fileLike({ name: 'broken.png' }), TEXTURE_SLOT_BY_KEY.map);

    // Crucially `ok` is false: the caller must not replace a working texture
    // with a broken one.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Could not decode/);
  });

  it('revokes the URL when decoding fails', async () => {
    setImageDecoder(async () => {
      throw new Error('boom');
    });

    await loadTextureFromFile(fileLike({ name: 'broken.png' }), TEXTURE_SLOT_BY_KEY.map);

    // A URL leaked per failed import is a real leak in a long session.
    expect(revoked).toEqual(created);
  });

  it('never creates a URL for an invalid file', async () => {
    const result = await loadTextureFromFile(
      fileLike({ name: 'notes.txt', type: 'text/plain' }),
      TEXTURE_SLOT_BY_KEY.map,
    );
    expect(result.ok).toBe(false);
    // Rejected BEFORE any resource was created.
    expect(created).toHaveLength(0);
    expect(revoked).toHaveLength(0);
  });

  it('rejects an image beyond the maximum texture dimension', async () => {
    setImageDecoder(async () => fakeImage(MAX_TEXTURE_DIMENSION + 1, 16));

    const result = await loadTextureFromFile(fileLike({ name: 'huge.png' }), TEXTURE_SLOT_BY_KEY.map);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(new RegExp(`${MAX_TEXTURE_DIMENSION}px`));
  });

  it('rejects a decoded image with no usable dimensions', async () => {
    setImageDecoder(async () => fakeImage(0, 0));

    const result = await loadTextureFromFile(fileLike({ name: 'zero.png' }), TEXTURE_SLOT_BY_KEY.map);

    expect(result.ok).toBe(false);
  });

  it('closes an oversized bitmap so its memory is not retained', async () => {
    const close = vi.fn();
    setImageDecoder(async () => ({ width: MAX_TEXTURE_DIMENSION + 1, height: 4, close }) as never);

    await loadTextureFromFile(fileLike({ name: 'huge.png' }), TEXTURE_SLOT_BY_KEY.map);

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reports a clear error when object URLs are unavailable', async () => {
    setObjectUrlFactory(() => {
      throw new Error('Object URLs are not available in this environment');
    });

    const result = await loadTextureFromFile(fileLike({ name: 'x.png' }), TEXTURE_SLOT_BY_KEY.map);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Object URLs/);
  });

  it('tolerates a failing revoker', () => {
    setObjectUrlRevoker(() => {
      throw new Error('cannot revoke');
    });
    // A revocation failure must never propagate: it runs on the disposal path.
    expect(() => releaseObjectUrl('blob:whatever')).not.toThrow();
    expect(() => releaseObjectUrl(null)).not.toThrow();
  });
});
