import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AnimationMixer, Box3, type Group, type PerspectiveCamera } from 'three';
import { useModelLoader } from '@/hooks/useModelLoader';
import { useViewerStore } from '@/stores/useViewerStore';
import { framePose } from './viewerUtils';
import { viewerRuntime } from './viewerRuntime';

interface ModelMeshProps {
  modelUrl: string;
  onReady?: () => void;
}

export function ModelMesh({ modelUrl, onReady }: ModelMeshProps) {
  const { scene, animations } = useModelLoader(modelUrl);
  const groupRef = useRef<Group>(null);
  const mixerRef = useRef<AnimationMixer | null>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const isWireframe = useViewerStore((s) => s.isWireframe);
  const activeClip = useViewerStore((s) => s.activeClip);
  const isPlaying = useViewerStore((s) => s.isPlaying);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useEffect(() => {
    scene.traverse((child) => {
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
  }, [scene, isWireframe]);

  useEffect(() => {
    const root = groupRef.current;
    if (!root) return undefined;
    viewerRuntime.modelRoot = root;
    return () => {
      if (viewerRuntime.modelRoot === root) viewerRuntime.modelRoot = null;
    };
  }, [scene]);

  useEffect(() => {
    const root = groupRef.current;
    if (!root) return;
    root.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(root);
    const fov = (camera as PerspectiveCamera).fov ?? 45;
    const pose = framePose(box, fov, size.width / Math.max(size.height, 1));
    if (pose) useViewerStore.getState().setCameraPose(pose);
    onReadyRef.current?.();
  }, [scene, camera, size.width, size.height]);

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

  useEffect(() => {
    if (animations.length === 0) return undefined;
    const mixer = new AnimationMixer(scene);
    mixerRef.current = mixer;
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
      mixerRef.current = null;
    };
  }, [scene, animations]);

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

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}
