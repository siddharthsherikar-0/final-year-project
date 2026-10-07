import { describe, it, expect, vi, afterEach } from 'vitest';
import { Box3, Vector3 } from 'three';
import {
  ENVIRONMENT_PRESETS,
  SHORTCUTS,
  captureScreenshot,
  downloadDataUrl,
  framePose,
  modelSlug,
  nextZoomPose,
  shortcutAction,
  zoomLevel,
} from '@/components/viewer/viewerUtils';

describe('framePose', () => {
  it('returns a pose aimed at the box center with safe distance', () => {
    const box = new Box3(
      new Vector3(-1, -1, -1),
      new Vector3(1, 1, 1),
    );
    const pose = framePose(box, 45, 1);

    expect(pose).not.toBeNull();
    expect(pose!.target).toEqual([0, 0, 0]);

    const position = new Vector3(...pose!.position);
    const distance = position.distanceTo(new Vector3(0, 0, 0));
    expect(distance).toBeGreaterThan(1);
    expect(Number.isFinite(distance)).toBe(true);
  });

  it('centers on an offset box', () => {
    const box = new Box3(
      new Vector3(4, 0, -2),
      new Vector3(6, 2, 0),
    );
    const pose = framePose(box, 45, 1);
    expect(pose).not.toBeNull();
    expect(pose!.target[0]).toBeCloseTo(5, 5);
    expect(pose!.target[1]).toBeCloseTo(1, 5);
    expect(pose!.target[2]).toBeCloseTo(-1, 5);
  });

  it('accounts for the viewport aspect ratio', () => {
    const box = new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
    const wide = framePose(box, 45, 3)!;
    const tall = framePose(box, 45, 0.5)!;
    const wideDistance = new Vector3(...wide.position).length();
    const tallDistance = new Vector3(...tall.position).length();
    expect(wideDistance).toBeLessThan(tallDistance);
  });

  it('returns null for an empty box', () => {
    const box = new Box3(new Vector3(0, 0, 0), new Vector3(0, 0, 0));
    expect(framePose(box, 45, 1)).toBeNull();
  });
});

describe('zoomLevel', () => {
  it('maps the minimum distance to 100% and the maximum to 0%', () => {
    expect(zoomLevel([0, 0, 0.05], [0, 0, 0], 0.05, 1000)).toBeCloseTo(1, 5);
    expect(zoomLevel([0, 0, 1000], [0, 0, 0], 0.05, 1000)).toBeCloseTo(0, 5);
  });

  it('stays within 0..1 for a typical distance', () => {
    const value = zoomLevel([0, 1, 5], [0, 0, 0], 0.05, 1000);
    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
  });
});

describe('nextZoomPose', () => {
  const pose = { position: [0, 0, 10] as [number, number, number], target: [0, 0, 0] as [number, number, number] };

  it('shortens the distance when zooming in', () => {
    const next = nextZoomPose(pose, 0.8, 0.05, 1000);
    expect(new Vector3(...next.position).length()).toBeCloseTo(8, 5);
    expect(next.target).toEqual(pose.target);
  });

  it('lengthens the distance when zooming out', () => {
    const next = nextZoomPose(pose, 1.25, 0.05, 1000);
    expect(new Vector3(...next.position).length()).toBeCloseTo(12.5, 5);
  });

  it('clamps at the minimum and maximum distances', () => {
    const tight = nextZoomPose({ position: [0, 0, 0.06], target: [0, 0, 0] }, 0.5, 0.05, 1000);
    expect(new Vector3(...tight.position).length()).toBeCloseTo(0.05, 5);

    const far = nextZoomPose({ position: [0, 0, 900], target: [0, 0, 0] }, 1.5, 0.05, 1000);
    expect(new Vector3(...far.position).length()).toBeCloseTo(1000, 3);
  });

  it('recovers from a degenerate zero-length offset', () => {
    const next = nextZoomPose({ position: [0, 0, 0], target: [0, 0, 0] }, 0.8, 0.05, 1000);
    expect(new Vector3(...next.position).length()).toBeCloseTo(0.8, 5);
  });
});

describe('modelSlug', () => {
  it('slugifies names and normalizes the extension', () => {
    const slug = modelSlug('Cyber Rig!', 'GLB');
    expect(slug.startsWith('cyber-rig-')).toBe(true);
    expect(slug.endsWith('.glb')).toBe(true);
  });

  it('falls back for empty or unusable input', () => {
    const slug = modelSlug('   ', '');
    expect(slug.startsWith('model-')).toBe(true);
    expect(slug.endsWith('.glb')).toBe(true);
  });
});

describe('shortcutAction', () => {
  const base = { shiftKey: false, ctrlKey: false, metaKey: false, altKey: false };

  it('maps plain keys case-insensitively', () => {
    expect(shortcutAction({ ...base, key: 'r' })).toBe('reset');
    expect(shortcutAction({ ...base, key: 'R' })).toBe('reset');
    expect(shortcutAction({ ...base, key: 'f' })).toBe('frame');
    expect(shortcutAction({ ...base, key: '+' })).toBe('zoomIn');
    expect(shortcutAction({ ...base, key: '=' })).toBe('zoomIn');
    expect(shortcutAction({ ...base, key: '-' })).toBe('zoomOut');
    expect(shortcutAction({ ...base, key: 'a' })).toBe('autoRotate');
    expect(shortcutAction({ ...base, key: 'o' })).toBe('orbit');
    expect(shortcutAction({ ...base, key: 'g' })).toBe('grid');
    expect(shortcutAction({ ...base, key: 'x' })).toBe('axes');
    expect(shortcutAction({ ...base, key: 'w' })).toBe('wireframe');
    expect(shortcutAction({ ...base, key: 'b' })).toBe('background');
    expect(shortcutAction({ ...base, key: 's' })).toBe('screenshot');
  });

  it('resolves Shift+F to fullscreen and ? to help', () => {
    expect(shortcutAction({ ...base, shiftKey: true, key: 'f' })).toBe('fullscreen');
    expect(shortcutAction({ ...base, shiftKey: true, key: 'F' })).toBe('fullscreen');
    expect(shortcutAction({ ...base, shiftKey: true, key: '/' })).toBe('help');
    expect(shortcutAction({ ...base, key: '?' })).toBe('help');
  });

  it('ignores modified keys and unmapped keys', () => {
    expect(shortcutAction({ ...base, ctrlKey: true, key: 'r' })).toBeNull();
    expect(shortcutAction({ ...base, metaKey: true, key: 's' })).toBeNull();
    expect(shortcutAction({ ...base, altKey: true, key: 'g' })).toBeNull();
    expect(shortcutAction({ ...base, key: 'q' })).toBeNull();
    expect(shortcutAction({ ...base, key: 'Control' })).toBeNull();
  });

  it('documents every dock action that has a shortcut', () => {
    const labels = SHORTCUTS.map((s) => s.keys);
    expect(labels).toContain('R');
    expect(labels).toContain('Shift + F');
    expect(labels).toContain('?');
    expect(SHORTCUTS.length).toBe(12);
  });
});

describe('environment presets', () => {
  it('ships three offline presets with background colors and light rigs', () => {
    expect(Object.keys(ENVIRONMENT_PRESETS)).toEqual([
      'studio',
      'midnight',
      'sunset',
    ]);
    for (const preset of Object.values(ENVIRONMENT_PRESETS)) {
      expect(preset.background).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.lightformers.length).toBeGreaterThanOrEqual(3);
      for (const light of preset.lightformers) {
        expect(['rect', 'circle', 'ring']).toContain(light.form);
        expect(light.position).toHaveLength(3);
        expect(light.scale).toHaveLength(3);
        expect(light.intensity).toBeGreaterThan(0);
      }
    }
  });
});

describe('captureScreenshot', () => {
  it('returns null when the runtime is not registered', () => {
    expect(captureScreenshot({ gl: null, scene: null, camera: null })).toBeNull();
  });

  it('renders and encodes the canvas when the runtime is available', () => {
    const render = vi.fn();
    const toDataURL = vi.fn().mockReturnValue('data:image/png;base64,AAA');
    const result = captureScreenshot({
      gl: { render, domElement: { toDataURL } } as never,
      scene: {} as never,
      camera: {} as never,
    });
    expect(render).toHaveBeenCalledTimes(1);
    expect(toDataURL).toHaveBeenCalledWith('image/png');
    expect(result).toBe('data:image/png;base64,AAA');
  });

  it('returns null when rendering throws', () => {
    const result = captureScreenshot({
      gl: {
        render: () => {
          throw new Error('context lost');
        },
        domElement: { toDataURL: () => 'nope' },
      } as never,
      scene: {} as never,
      camera: {} as never,
    });
    expect(result).toBeNull();
  });
});

describe('downloadDataUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a hidden anchor and clicks it', () => {
    let captured: { href: string | null; download: string | null } | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      captured = {
        href: this.getAttribute('href'),
        download: this.getAttribute('download'),
      };
    });

    downloadDataUrl('data:image/png;base64,AAA', 'duck-1.glb');

    expect(captured).toEqual({
      href: 'data:image/png;base64,AAA',
      download: 'duck-1.glb',
    });
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
