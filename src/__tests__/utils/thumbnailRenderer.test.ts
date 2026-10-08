import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const renderOneFrame = vi.fn();
const forceContextLoss = vi.fn();
const rendererDispose = vi.fn();

class FakeWebGLContext {
  private attributes = new Map<string, unknown>();
  getContextAttributes() {
    return this.attributes;
  }
}

class FakeRenderer {
  domElement = {
    toDataURL: (type: string, quality: number) =>
      `data:${type};base64,STUDIO-FRAME-${quality}`,
  };
  setPixelRatio = vi.fn();
  setSize = vi.fn();
  setClearColor = vi.fn();
  render = renderOneFrame;
  dispose = rendererDispose;
  forceContextLoss = forceContextLoss;
}

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return {
    ...actual,
    WebGLRenderer: vi.fn(() => new FakeRenderer()),
  };
});

const loadMock = vi.fn();
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setDRACOLoader = vi.fn();
    load = loadMock;
  },
}));

vi.mock('three/examples/jsm/loaders/DRACOLoader.js', () => ({
  DRACOLoader: class {
    setDecoderPath = vi.fn();
    setDecoderConfig = vi.fn();
    dispose = vi.fn();
  },
}));

import * as THREE from 'three';
import {
  generateThumbnail,
  generateThumbnailFromFile,
  disposeThumbnailRenderer,
  isThumbnailRendererActive,
  ThumbnailError,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_WIDTH,
} from '@/utils/thumbnailRenderer';

/** Real three objects so bounding-box maths is exercised for real. */
function mesh(width: number, height: number, depth: number, y = 0) {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshBasicMaterial(),
  );
  object.position.y = y;
  object.updateMatrixWorld(true);
  return object;
}

function loadSucceeds(children: THREE.Object3D[]) {
  loadMock.mockImplementation((_url: string, onLoad: (gltf: unknown) => void) => {
    const root = new THREE.Group();
    root.add(...children);
    root.updateMatrixWorld(true);
    onLoad({ scene: root });
  });
}

beforeEach(() => {
  loadMock.mockReset();
  renderOneFrame.mockClear();
  rendererDispose.mockClear();
  forceContextLoss.mockClear();
  vi.stubGlobal('WebGLRenderingContext', FakeWebGLContext);
});

afterEach(() => {
  disposeThumbnailRenderer();
  vi.unstubAllGlobals();
});

describe('generateThumbnail', () => {
  it('renders one frame and returns an encoded image at the studio size', async () => {
    loadSucceeds([mesh(2, 2, 2)]);
    const result = await generateThumbnail('/models/duck.glb');

    expect(result.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(result.width).toBe(THUMBNAIL_WIDTH);
    expect(result.height).toBe(THUMBNAIL_HEIGHT);
    expect(renderOneFrame).toHaveBeenCalledTimes(1);
  });

  it('reuses a single WebGL renderer across many models', async () => {
    loadSucceeds([mesh(2, 2, 2)]);
    await generateThumbnail('/models/duck.glb');
    await generateThumbnail('/models/box.glb');
    await generateThumbnail('/models/cesium-man.glb');

    // One studio, three renders, three encoded frames.
    expect(renderOneFrame).toHaveBeenCalledTimes(3);
    expect(isThumbnailRendererActive()).toBe(true);
  });

  it('rejects with a typed reason when the model cannot be loaded', async () => {
    loadMock.mockImplementation((_url: string, _ok: unknown, onError: () => void) => onError());

    await expect(generateThumbnail('/models/broken.glb')).rejects.toBeInstanceOf(
      ThumbnailError,
    );
    await expect(generateThumbnail('/models/broken.glb')).rejects.toMatchObject({
      reason: 'load-failed',
    });
  });

  it('rejects models without visible geometry', async () => {
    loadSucceeds([]);
    await expect(generateThumbnail('/models/empty.glb')).rejects.toMatchObject({
      reason: 'empty-model',
    });
  });

  it('times out instead of hanging the upload flow', async () => {
    loadMock.mockImplementation(() => {
      /* never calls back */
    });

    await expect(
      generateThumbnail('/models/slow.glb', { timeoutMs: 10 }),
    ).rejects.toMatchObject({ reason: 'timeout' });
  });

  it('releases the WebGL context when the studio is disposed', async () => {
    loadSucceeds([mesh(2, 2, 2)]);
    await generateThumbnail('/models/duck.glb');

    disposeThumbnailRenderer();

    expect(rendererDispose).toHaveBeenCalled();
    expect(forceContextLoss).toHaveBeenCalled();
    expect(isThumbnailRendererActive()).toBe(false);
  });
});

describe('generateThumbnailFromFile', () => {
  it('revokes the temporary object URL even when rendering fails', async () => {
    const createObjectURL = vi.fn(() => 'blob:upload-1');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    loadMock.mockImplementation((_url: string, _ok: unknown, onError: () => void) => onError());

    const file = new File(['glb'], 'ship.glb', { type: 'model/gltf-binary' });
    await expect(generateThumbnailFromFile(file)).rejects.toBeInstanceOf(ThumbnailError);

    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:upload-1');
  });

  it('revokes the object URL on the success path too', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:upload-2'),
      revokeObjectURL,
    });
    loadSucceeds([mesh(2, 2, 2)]);

    const file = new File(['glb'], 'ok.glb', { type: 'model/gltf-binary' });
    const result = await generateThumbnailFromFile(file);

    expect(result.dataUrl).toContain('STUDIO-FRAME');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:upload-2');
  });
});
