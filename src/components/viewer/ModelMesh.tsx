import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AnimationMixer, Box3, type Group, type PerspectiveCamera } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useModelLoader } from '@/hooks/useModelLoader';
import { useViewerStore } from '@/stores/useViewerStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { framePose } from './viewerUtils';
import { describeScene } from '@/utils/sceneInspection';
import { viewerRuntime } from './viewerRuntime';
import { createWorkingScene, type WorkingScene } from '@/editor/workingScene';
import { buildSceneTree } from '@/editor/sceneTree';
import { setEditorWorkingScene, getEditorWorkingScene } from '@/editor/editorRuntime';
import { clearHistory } from '@/editor/history/history';
import { findSelectableAncestor } from '@/editor/picking';

interface ModelMeshProps {
  modelUrl: string;
  onReady?: () => void;
  /**
   * Enables editor picking. Off by default so the detail page's embedded
   * viewer keeps exactly the Stage 8 behaviour.
   */
  selectable?: boolean;
}

export function ModelMesh({ modelUrl, onReady, selectable = false }: ModelMeshProps) {
  // `useModelLoader` already hands back a SkeletonUtils clone of the cached
  // GLTF. The working scene wraps that in an ownership layer: the node tree is
  // cloned again (cheap) and every distinct material is cloned once into
  // editor-owned resources, which is what stops an edit from reaching the
  // shared useGLTF cache.
  const { scene: loadedScene, animations } = useModelLoader(modelUrl);

  const working: WorkingScene = useMemo(
    () => createWorkingScene(loadedScene),
    [loadedScene],
  );

  const groupRef = useRef<Group>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const onReadyRef = useRef(onReady);
  // Captured for the frame-2 callback without reading a ref during render.
  const workingAtFrame = useRef(working);
  useEffect(() => {
    workingAtFrame.current = working;
  }, [working]);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const isWireframe = useViewerStore((s) => s.isWireframe);
  const activeClip = useViewerStore((s) => s.activeClip);
  const isPlaying = useViewerStore((s) => s.isPlaying);
  const geometryEpoch = useEditorStore((s) => s.geometryEpoch);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const framesRendered = useRef(0);
  // Inspection is first published on frame 2; only then may a geometry change
  // trigger a refresh (before that there is nothing to report).
  const inspectionPublished = useRef(false);

  // Object creation, regeneration, duplication and deletion change the scene
  // after load, so the Stage 8 inspection readout is refreshed from the same
  // live scene instead of staying frozen at its frame-2 values.
  //
  // `materialEpoch` is included because Stage 9D material editing changes the
  // material count and texture count the panel reports without touching any
  // geometry - without it, assigning a new material would leave stale stats.
  const materialEpoch = useEditorStore((s) => s.materialEpoch);
  useEffect(() => {
    if (!inspectionPublished.current) return;
    const root = groupRef.current;
    if (!root) return;
    let inspection;
    try {
      inspection = describeScene(root, animations);
    } catch {
      inspection = null;
    }
    useViewerStore.getState().setSceneInspection(inspection);
  }, [geometryEpoch, materialEpoch, animations]);

  // Publish the working scene, build the serialisable hierarchy, and on
  // teardown dispose ONLY the resources this scene owns.
  useEffect(() => {
    setEditorWorkingScene(working);
    useEditorStore.getState().setTree(buildSceneTree(working.root, working.registry));
    // History is scene-scoped: its ids belong to THIS working scene. Carrying it
    // across a model swap would let an undo resolve against the wrong tree, so it
    // is cleared whenever the scene is replaced.
    clearHistory();

    return () => {
      if (getEditorWorkingScene() === working) setEditorWorkingScene(null);
      useEditorStore.getState().setTree(null);
      useEditorStore.getState().clearSelection();
      // Disposes owned materials/geometries only; cached source resources and
      // any other viewer of this URL are untouched.
      working.dispose();
    };
  }, [working]);

  // Wireframe now only ever touches editor-owned materials. Before the
  // ownership layer this mutated the shared cached material, which leaked the
  // toggle into every other viewer of the same URL.
  useEffect(() => {
    working.root.traverse((child) => {
      const mesh = child as { isMesh?: boolean; material?: unknown };
      if (!mesh.isMesh || !mesh.material) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.forEach((material) => {
        const mat = material as { wireframe?: boolean } | undefined;
        if (mat) mat.wireframe = isWireframe;
      });
    });
  }, [working, isWireframe]);

  useEffect(() => {
    const root = groupRef.current;
    if (!root) return undefined;
    viewerRuntime.modelRoot = root;
    return () => {
      if (viewerRuntime.modelRoot === root) viewerRuntime.modelRoot = null;
    };
  }, [working]);

  useEffect(() => {
    onReadyRef.current?.();
  }, [working]);

  useEffect(() => {
    return () => {
      useViewerStore.getState().setSceneInspection(null);
    };
  }, [working]);

  useEffect(() => {
    const names = animations.map(
      (clip, index) => clip.name?.trim() || `Clip ${index + 1}`,
    );
    const current = useViewerStore.getState().animationClips;
    const changed =
      current.length !== names.length ||
      current.some((name, index) => name !== names[index]);
    if (changed) useViewerStore.getState().setAnimationClips(names);
  }, [animations]);

  // The mixer must root at the WORKING scene, otherwise playback would pose the
  // loader's throwaway clone instead of the objects the user can select.
  useEffect(() => {
    if (animations.length === 0) return undefined;
    const mixer = new AnimationMixer(working.root);
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(working.root);
      mixerRef.current = null;
    };
  }, [working, animations]);

  useEffect(() => {
    const mixer = mixerRef.current;
    if (!mixer) return;
    mixer.stopAllAction();
    if (!isPlaying) return;
    const clip = animations[Math.min(activeClip, Math.max(animations.length - 1, 0))];
    if (clip) mixer.clipAction(clip).reset().play();
  }, [activeClip, isPlaying, animations]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  // Framing and scene inspection both wait for the second rendered frame. A
  // skinned mesh reports its flat bind-pose bounds until the skeleton has been
  // posed, which would clip tall assets out of the viewport and report the
  // wrong dimensions. Registration order matters: this callback runs after the
  // mixer update above, so the pose is current.
  useFrame(() => {
    framesRendered.current += 1;
    if (framesRendered.current !== 2) return;

    const root = groupRef.current;
    if (!root) return;

    root.updateWorldMatrix(true, true);

    const box = new Box3().setFromObject(root);
    const fov = (camera as PerspectiveCamera).fov ?? 45;
    const pose = framePose(box, fov, size.width / Math.max(size.height, 1));
    if (pose) useViewerStore.getState().setCameraPose(pose);

    // describeScene never throws, but a guard keeps a corrupt scene from ever
    // stopping the viewport from rendering.
    let inspection;
    try {
      inspection = describeScene(root, animations);
    } catch {
      inspection = null;
    }
    useViewerStore.getState().setSceneInspection(inspection);
    inspectionPublished.current = true;

    // Names may have settled after the loader resolved.
    useEditorStore
      .getState()
      .setTree(buildSceneTree(workingAtFrame.current.root, workingAtFrame.current.registry));
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!selectable) return;
    const target = findSelectableAncestor(event.object, working.registry);
    if (!target) return;
    event.stopPropagation();
    const id = working.registry.idOf(target);
    if (!id) return;
    const additive = event.shiftKey || event.ctrlKey || event.metaKey;
    useEditorStore.getState().select(id, additive);
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    if (!selectable) return;
    const target = findSelectableAncestor(event.object, working.registry);
    if (!target) return;
    const id = working.registry.idOf(target);
    useEditorStore.getState().setHovered(id);
  };

  const handlePointerOut = () => {
    if (!selectable) return;
    useEditorStore.getState().setHovered(null);
  };

  return (
    <group ref={groupRef}>
      <primitive
        object={working.root}
        onClick={selectable ? handleClick : undefined}
        onPointerOver={selectable ? handlePointerOver : undefined}
        onPointerOut={selectable ? handlePointerOut : undefined}
      />
    </group>
  );
}