export interface GltfFixture {
  asset: { version: string };
  meshes: Array<{ primitives: Array<{ attributes: { POSITION: number }; indices?: number }> }>;
  accessors: Array<{ count: number }>;
  textures: Array<Record<string, unknown>>;
  animations: Array<{ name: string }>;
}

export function makeGltfJson(): GltfFixture {
  return {
    asset: { version: '2.0' },
    meshes: [
      { primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] },
      { primitives: [{ attributes: { POSITION: 2 } }] },
    ],
    accessors: [{ count: 6 }, { count: 36 }, { count: 9 }],
    textures: [{}, {}],
    animations: [{ name: 'idle' }],
  };
}

export const FIXTURE_STATS = {
  vertices: 15,
  triangles: 15,
  textures: 2,
  animations: 1,
} as const;

export function buildGlbBuffer(json: unknown): ArrayBuffer {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const padding = (4 - (jsonBytes.length % 4)) % 4;
  const chunkLength = jsonBytes.length + padding;
  const total = 12 + 8 + chunkLength;
  const buffer = new ArrayBuffer(total);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, chunkLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.set(jsonBytes, 20);
  for (let i = 0; i < padding; i += 1) {
    bytes[20 + jsonBytes.length + i] = 0x20;
  }
  return buffer;
}

export function makeGlbFile(name = 'model.glb'): File {
  return new File([buildGlbBuffer(makeGltfJson())], name, {
    type: 'model/gltf-binary',
  });
}
