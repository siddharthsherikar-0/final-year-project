import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ViewerDock } from '@/components/viewer/ViewerDock';
import { useViewerStore } from '@/stores/useViewerStore';

function renderDock() {
  const props = {
    onReset: vi.fn(),
    onFrame: vi.fn(),
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onScreenshot: vi.fn(),
    onFullscreen: vi.fn(),
    onToggleHelp: vi.fn(),
    onTogglePanel: vi.fn(),
    fullscreenAvailable: true,
    helpOpen: false,
    panelOpen: false,
  };
  render(<ViewerDock {...props} />);
  return props;
}

beforeEach(() => {
  useViewerStore.setState({
    isWireframe: false,
    autoRotate: false,
    showGrid: true,
    showAxes: false,
    orbitEnabled: true,
    environment: 'studio',
  });
});

describe('ViewerDock tooltip accessibility', () => {
  it('exposes every control tooltip with role="tooltip"', () => {
    renderDock();
    const tooltips = screen.getAllByRole('tooltip', { hidden: true });
    // One tooltip per dock control (14 controls).
    expect(tooltips).toHaveLength(14);
    for (const tooltip of tooltips) {
      expect(tooltip.id).toBeTruthy();
    }
  });

  it('associates each control with its tooltip via aria-describedby', () => {
    renderDock();
    const reset = screen.getByRole('button', { name: 'Reset camera' });
    const describedBy = reset.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();

    const tooltip = document.getElementById(describedBy!);
    expect(tooltip).not.toBeNull();
    expect(tooltip).toHaveAttribute('role', 'tooltip');
    expect(tooltip).toHaveTextContent('Reset camera');
  });

  it('gives every control a describedby id that resolves inside the same subtree', () => {
    const { container } = render(
      <ViewerDock
        onReset={vi.fn()}
        onFrame={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onScreenshot={vi.fn()}
        onFullscreen={vi.fn()}
        onToggleHelp={vi.fn()}
        onTogglePanel={vi.fn()}
        fullscreenAvailable
        helpOpen={false}
        panelOpen={false}
      />,
    );
    const buttons = [...container.querySelectorAll('button')];
    const ids = new Set<string>();
    for (const button of buttons) {
      const id = button.getAttribute('aria-describedby');
      if (!id) continue;
      ids.add(id);
      const target = container.querySelector(`#${CSS.escape(id)}`);
      expect(target).not.toBeNull();
    }
    expect(ids.size).toBe(buttons.length);
  });

  it('announces the keyboard shortcut inside the description', () => {
    renderDock();
    const frame = screen.getByRole('button', { name: 'Frame model' });
    const tooltip = document.getElementById(frame.getAttribute('aria-describedby')!);
    expect(tooltip).toHaveTextContent(/keyboard shortcut F/i);
  });

  it('keeps the tooltip visible on keyboard focus (group-focus-visible reveal)', () => {
    const { container } = render(
      <ViewerDock
        onReset={vi.fn()}
        onFrame={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onScreenshot={vi.fn()}
        onFullscreen={vi.fn()}
        onToggleHelp={vi.fn()}
        onTogglePanel={vi.fn()}
        fullscreenAvailable
        helpOpen={false}
        panelOpen={false}
      />,
    );
    const tooltip = container.querySelector('[role="tooltip"]')!;
    const classes = tooltip.getAttribute('class') ?? '';
    expect(classes).toContain('group-hover:opacity-100');
    expect(classes).toContain('group-focus-visible:opacity-100');
    expect(classes).toContain('pointer-events-none');
    expect(classes).toContain('motion-reduce:transition-none');
  });

  it('keeps the accessible name on the control (aria-label) and toggles aria-pressed', () => {
    renderDock();
    const grid = screen.getByRole('button', { name: 'Grid' });
    expect(grid).toHaveAttribute('aria-pressed', 'true');
    const axes = screen.getByRole('button', { name: 'Axes' });
    expect(axes).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables the fullscreen control and keeps its label when unsupported', () => {
    render(
      <ViewerDock
        onReset={vi.fn()}
        onFrame={vi.fn()}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onScreenshot={vi.fn()}
        onFullscreen={vi.fn()}
        onToggleHelp={vi.fn()}
        onTogglePanel={vi.fn()}
        fullscreenAvailable={false}
        helpOpen={false}
        panelOpen={false}
      />,
    );
    const button = screen.getByRole('button', {
      name: 'Fullscreen not supported',
    });
    expect(button).toBeDisabled();
    expect(
      document.getElementById(button.getAttribute('aria-describedby')!),
    ).not.toBeNull();
  });
});