import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import {
  AnimationClip,
  AnimationMixer,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
} from 'three';

const loaderHolder = vi.hoisted(() => ({
  scene: null as unknown,
  animations: [] as unknown[],
  throwErrorFor: null as string | null,
}));

const makeJsxFactory = vi.hoisted(() => {
  return async (importOriginal: () => Promise<unknown>) => {
    type JsxModule = typeof import('react/jsx-runtime');
    type JsxDevModule = typeof import('react/jsx-dev-runtime');
    const actual = (await importOriginal()) as JsxModule &
      JsxDevModule & { [key: string]: unknown };
    const React = await import('react');
    const THREE = await import('three');

    const ParentGroupContext = React.createContext<import('three').Group | null>(
      null,
    );

    const GroupHost = React.forwardRef<unknown, { children?: React.ReactNode }>(
      function GroupHost(props, ref) {
        const [group] = React.useState(() => new THREE.Group());
        React.useImperativeHandle(ref, () => group);
        return React.createElement(
          ParentGroupContext.Provider,
          { value: group },
          props.children,
        );
      },
    );

    function PrimitiveHost({ object }: { object?: import('three').Object3D }) {
      const parent = React.useContext(ParentGroupContext);
      React.useEffect(() => {
        if (!parent || !object) return undefined;
        parent.add(object);
        return () => {
          parent.remove(object);
        };
      }, [parent, object]);
      return null;
    }

    const remap = (type: unknown): unknown => {
      if (type === 'group') return GroupHost;
      if (type === 'primitive') return PrimitiveHost;
      return type;
    };

    return {
      ...actual,
      jsx: (type: never, props: never, key: never) =>
        actual.jsx(remap(type) as typeof type, props, key),
      jsxs: (type: never, props: never, key: never) =>
        actual.jsxs(remap(type) as typeof type, props, key),
      jsxDEV: (
        type: never,
        props: never,
        key: never,
        isStaticChildren: never,
        source: never,
        self: never,
      ) =>
        actual.jsxDEV(
          remap(type) as typeof type,
          props,
          key,
          isStaticChildren,
          source,
          self,
        ),
    };
  };
});

vi.mock('react/jsx-runtime', makeJsxFactory);
vi.mock('react/jsx-dev-runtime', makeJsxFactory);

const fiberState = { camera: { fov: 45 }, size: { width: 800, height: 600 } };

vi.mock('@react-three/fiber', () => ({
  useFrame: () => undefined,
  useThree: (
    selector: (state: typeof fiberState) => unknown,
  ): unknown => selector(fiberState),
}));

vi.mock('@react-three/drei', () => {
  const useGLTF = vi.fn((url: string) => {
    if (loaderHolder.throwErrorFor === url) {
      throw new Error(`GLTF load failed: ${url}`);
    }
    return { scene: loaderHolder.scene, animations: loaderHolder.animations };
  });
  return {
    useGLTF: Object.assign(useGLTF, {
      setDecoderPath: vi.fn(),
      clear: vi.fn(),
    }),
    useProgress: () => ({ progress: 0, active: false }),
  };
});

import { useGLTF } from '@react-three/drei';
import { useModelLoader } from '@/hooks/useModelLoader';
import { ModelMesh } from '@/components/viewer/ModelMesh';
import { viewerRuntime } from '@/components/viewer/viewerRuntime';
import { getEditorWorkingScene, setEditorWorkingScene } from '@/editor/editorRuntime';
import { useViewerStore } from '@/stores/useViewerStore';

function makeSourceScene(): { source: Group; material: MeshBasicMaterial } {
  const source = new Group();
  const material = new MeshBasicMaterial();
  source.add(new Mesh(new BoxGeometry(1, 1, 1), material));
  return { source, material };
}

beforeEach(() => {
  vi.mocked(useGLTF).mockClear();
  loaderHolder.scene = null;
  loaderHolder.animations = [];
  loaderHolder.throwErrorFor = null;
  useViewerStore.setState({
    cameraPosition: [0, 1, 5],
    controlsTarget: [0, 0, 0],
    isWireframe: false,
    animationClips: [],
    activeClip: 0,
    isPlaying: false,
  });
  viewerRuntime.modelRoot = null;
  setEditorWorkingScene(null);
});

afterEach(() => {
  viewerRuntime.modelRoot = null;
  setEditorWorkingScene(null);
});

describe('Phase I model loading and mesh lifecycle regressions', () => {
  it('decodes GLBs with the local Draco path and clones cache-missed scenes', () => {
    expect(useGLTF.setDecoderPath).toHaveBeenCalledWith('/draco/');

    const { source } = makeSourceScene();
    loaderHolder.scene = source;
    loaderHolder.animations = [];

    const { result } = renderHook(() => useModelLoader('/models/new.glb'));

    expect(useGLTF).toHaveBeenCalledWith('/models/new.glb', true);
    expect(result.current.scene).not.toBe(source);
    expect(result.current.scene.children).toHaveLength(1);
    expect(
      (result.current.scene.children[0] as Mesh).isMesh,
    ).toBe(true);
  });

  it('propagates a load failure for an unreadable cache-missed GLB', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    loaderHolder.throwErrorFor = '/models/broken.glb';

    expect(() => renderHook(() => useModelLoader('/models/broken.glb'))).toThrow(
      'GLTF load failed',
    );

    loaderHolder.throwErrorFor = null;
    consoleError.mockRestore();
  });

  it('publishes clips, plays the active clip, toggles wireframe, and stops the mixer on unmount', () => {
    const { source, material } = makeSourceScene();
    loaderHolder.scene = source;
    loaderHolder.animations = [
      new AnimationClip('Walk', 1, []),
      new AnimationClip('Run', 2, []),
    ];

    const clipActionSpy = vi.spyOn(AnimationMixer.prototype, 'clipAction');
    const stopAllSpy = vi.spyOn(AnimationMixer.prototype, 'stopAllAction');
    const onReady = vi.fn();

    const { unmount } = render(
      <ModelMesh modelUrl="/models/duck.glb" onReady={onReady} />,
    );

    expect(onReady).toHaveBeenCalled();
    expect(viewerRuntime.modelRoot).not.toBeNull();
    expect(useViewerStore.getState().animationClips).toEqual(['Walk', 'Run']);

    act(() => {
      useViewerStore.setState({ isPlaying: true });
    });
    expect(clipActionSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Walk' }),
    );

    act(() => {
      useViewerStore.setState({ isWireframe: true });
    });

    // Stage 9B: wireframe is applied to the editor-owned working material only.
    // Before the ownership layer this assertion read the CACHED material,
    // which is precisely the shared-state defect the audit confirmed.
    const workingScene = getEditorWorkingScene();
    expect(workingScene).not.toBeNull();
    const workingMeshes: Mesh[] = [];
    workingScene!.root.traverse((child) => {
      if ((child as Mesh).isMesh) workingMeshes.push(child as Mesh);
    });
    expect(workingMeshes).toHaveLength(1);
    expect(
      (workingMeshes[0]!.material as MeshBasicMaterial).wireframe,
    ).toBe(true);
    // The cached source material must never be touched.
    expect(material.wireframe).toBe(false);

    stopAllSpy.mockClear();
    unmount();
    expect(stopAllSpy).toHaveBeenCalled();
    expect(viewerRuntime.modelRoot).toBeNull();

    clipActionSpy.mockRestore();
    stopAllSpy.mockRestore();
  });
});
