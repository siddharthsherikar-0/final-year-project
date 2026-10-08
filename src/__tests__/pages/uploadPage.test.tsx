import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom';
import { UploadPage } from '@/pages/UploadPage';
import { useAuthStore } from '@/stores/useAuthStore';
import { makeGlbFile, FIXTURE_STATS } from '../helpers/gltfFixture';

vi.mock('@/components/viewer/ModelViewer', () => ({
  ModelViewer: ({ modelUrl, modelName }: { modelUrl: string; modelName?: string }) => (
    <div data-testid="model-viewer" data-url={modelUrl}>
      {modelName}
    </div>
  ),
}));

class FakeXHR {
  static instances: FakeXHR[] = [];
  upload: { onprogress?: (event: ProgressEvent) => void } = {};
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  status = 0;
  responseText = '';
  method = '';
  url = '';
  headers: Record<string, string> = {};
  body: unknown = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
    FakeXHR.instances.push(this);
  }

  setRequestHeader(key: string, value: string) {
    this.headers[key] = value;
  }

  send(body: unknown) {
    this.body = body;
  }

  abort() {}

  respond(status: number, body: unknown) {
    this.status = status;
    this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
    this.onload?.();
  }

  failNetwork() {
    this.onerror?.();
  }

  progress(loaded: number, total: number) {
    this.upload.onprogress?.({
      lengthComputable: true,
      loaded,
      total,
    } as ProgressEvent);
  }
}

function ModelRouteProbe() {
  const { id } = useParams();
  return <div data-testid="model-route" data-id={id} />;
}

function renderUpload() {
  return render(
    <MemoryRouter initialEntries={['/upload']}>
      <Routes>
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/model/:id" element={<ModelRouteProbe />} />
        <Route path="/login" element={<div data-testid="login-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

function chooseFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', {
    value: [file],
    configurable: true,
  });
  fireEvent.change(input);
}

function dropFile(zone: HTMLElement, file: File) {
  fireEvent.drop(zone, { dataTransfer: { files: [file] } });
}

async function selectValidFile(name = 'Dragon.glb') {
  const input = screen.getByTestId('upload-input') as HTMLInputElement;
  await act(async () => {
    chooseFile(input, makeGlbFile(name));
  });
  await screen.findByTestId('upload-file-card');
  await screen.findByTestId('upload-status-valid');
}

async function fillReadyToUpload() {
  await selectValidFile();
  fireEvent.change(screen.getByTestId('upload-name'), {
    target: { value: 'Dragon' },
  });
  fireEvent.change(screen.getByTestId('upload-description'), {
    target: { value: 'A friendly dragon' },
  });
  await waitFor(() =>
    expect(screen.getByTestId('upload-submit')).toBeEnabled(),
  );
}

beforeEach(() => {
  FakeXHR.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:mock-url'),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
  localStorage.setItem('token', 'test-token');
  useAuthStore.setState({
    token: 'test-token',
    isAuthenticated: true,
    user: null,
    error: null,
    isLoading: false,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.removeItem('token');
});

describe('UploadPage', () => {
  it('renders the dropzone with a disabled submit and a selection hint', () => {
    renderUpload();

    expect(screen.getByTestId('upload-dropzone')).toBeInTheDocument();
    expect(screen.getByTestId('upload-input')).toHaveAttribute(
      'accept',
      '.glb,.gltf',
    );
    expect(screen.getByTestId('upload-submit')).toBeDisabled();
    expect(screen.getByTestId('upload-hint')).toHaveTextContent(
      /select a model file/i,
    );
    expect(screen.queryByTestId('upload-file-card')).toBeNull();
    expect(screen.queryByTestId('upload-preview')).toBeNull();
  });

  it('selecting a valid GLB shows real stats, autofills the name, and enables submit once description is set', async () => {
    renderUpload();

    await selectValidFile('Dragon.glb');

    expect(screen.getByTestId('upload-filename')).toHaveTextContent(
      'Dragon.glb',
    );
    expect(screen.getByTestId('upload-format')).toHaveTextContent('GLB');
    expect(screen.getByTestId('upload-status-valid')).toBeInTheDocument();
    expect(screen.getByTestId('upload-stat-vertices')).toHaveTextContent(
      FIXTURE_STATS.vertices.toLocaleString('en-US'),
    );
    expect(screen.getByTestId('upload-stat-triangles')).toHaveTextContent(
      FIXTURE_STATS.triangles.toLocaleString('en-US'),
    );
    expect(screen.getByTestId('upload-stat-textures')).toHaveTextContent(
      FIXTURE_STATS.textures.toLocaleString('en-US'),
    );
    expect(screen.getByTestId('upload-stat-animations')).toHaveTextContent(
      FIXTURE_STATS.animations.toLocaleString('en-US'),
    );
    expect(screen.getByTestId('upload-name')).toHaveValue('Dragon');
    expect(await screen.findByTestId('upload-preview')).toBeInTheDocument();
    expect(screen.getByTestId('upload-submit')).toBeDisabled();
    expect(screen.getByTestId('upload-hint')).toHaveTextContent(
      /add a description/i,
    );

    fireEvent.change(screen.getByTestId('upload-description'), {
      target: { value: 'A friendly dragon' },
    });

    await waitFor(() =>
      expect(screen.getByTestId('upload-submit')).toBeEnabled(),
    );
  });

  it('rejects unsupported extensions before a file is accepted', async () => {
    renderUpload();

    const input = screen.getByTestId('upload-input') as HTMLInputElement;
    await act(async () => {
      chooseFile(
        input,
        new File(['x'], 'model.obj', { type: 'model/obj' }),
      );
    });

    expect(screen.getByTestId('upload-dropzone-error')).toHaveTextContent(
      /only glb and gltf/i,
    );
    expect(screen.queryByTestId('upload-file-card')).toBeNull();
    expect(screen.getByTestId('upload-submit')).toBeDisabled();
  });

  it('rejects files above the 50 MB limit', async () => {
    renderUpload();

    const input = screen.getByTestId('upload-input') as HTMLInputElement;
    const oversized = new File([new Uint8Array(1)], 'huge.glb');
    Object.defineProperty(oversized, 'size', {
      value: 51 * 1024 * 1024,
    });
    await act(async () => {
      chooseFile(input, oversized);
    });

    expect(screen.getByTestId('upload-dropzone-error')).toHaveTextContent(
      /too large.*50 mb/i,
    );
    expect(screen.queryByTestId('upload-file-card')).toBeNull();
    expect(screen.getByTestId('upload-submit')).toBeDisabled();
  });

  it('blocks malformed GLB files with an invalid status and no preview', async () => {
    renderUpload();

    const input = screen.getByTestId('upload-input') as HTMLInputElement;
    await act(async () => {
      chooseFile(
        input,
        new File([new Uint8Array([9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9])], 'broken.glb'),
      );
    });

    await screen.findByTestId('upload-status-invalid');
    expect(screen.getByTestId('upload-file-card')).toBeInTheDocument();
    expect(
      screen.getByTestId('upload-file-card'),
    ).toHaveTextContent(/could not be read as a glTF model/i);
    expect(screen.queryByTestId('upload-preview')).toBeNull();
    expect(screen.getByTestId('upload-submit')).toBeDisabled();
    expect(screen.getByTestId('upload-hint')).toHaveTextContent(
      /choose a valid glb or gltf/i,
    );
  });

  it('drops are rejected for bad files without clearing an existing valid selection', async () => {
    renderUpload();
    await selectValidFile('Dragon.glb');

    dropFile(
      screen.getByTestId('upload-dropzone'),
      new File(['x'], 'other.obj'),
    );

    expect(screen.getByTestId('upload-dropzone-error')).toHaveTextContent(
      /only glb and gltf/i,
    );
    expect(screen.getByTestId('upload-filename')).toHaveTextContent(
      'Dragon.glb',
    );
  });

  it('handles the full drop flow: drag styling, drop, stats, then upload with real progress to success', async () => {
    renderUpload();

    const zone = screen.getByTestId('upload-dropzone');
    fireEvent.dragEnter(zone, { dataTransfer: { files: [] } });
    expect(screen.getByTestId('dropzone-title')).toHaveTextContent(
      /drop your model here/i,
    );

    dropFile(zone, makeGlbFile('Castle.glb'));
    await screen.findByTestId('upload-file-card');
    expect(screen.getByTestId('upload-name')).toHaveValue('Castle');

    fireEvent.change(screen.getByTestId('upload-description'), {
      target: { value: 'A medieval castle' },
    });
    await waitFor(() =>
      expect(screen.getByTestId('upload-submit')).toBeEnabled(),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('upload-submit'));
    });

    expect(FakeXHR.instances).toHaveLength(1);
    const request = FakeXHR.instances[0]!;
    expect(request.method).toBe('POST');
    expect(request.url).toContain('/api/upload');
    expect(request.headers['Authorization']).toBe('Bearer test-token');
    expect(request.body).toBeInstanceOf(FormData);
    expect(screen.getByTestId('upload-name')).toBeDisabled();
    expect(screen.getByTestId('upload-description')).toBeDisabled();
    expect(screen.getByTestId('upload-submit')).toBeDisabled();
    expect(screen.getByTestId('upload-progress')).toHaveAttribute(
      'role',
      'progressbar',
    );
    expect(screen.getByTestId('upload-progress-text')).toHaveTextContent(
      /transferring/i,
    );

    act(() => {
      request.progress(50, 100);
    });
    expect(screen.getByTestId('upload-progress')).toHaveAttribute(
      'aria-valuenow',
      '50',
    );
    expect(screen.getByTestId('upload-progress-text')).toHaveTextContent(
      '50%',
    );

    await act(async () => {
      request.respond(201, { id: 'm-123', name: 'Castle' });
    });

    await screen.findByTestId('upload-success');
    expect(screen.getByTestId('upload-success-name')).toHaveTextContent(
      'Castle',
    );
    expect(screen.queryByTestId('upload-preview')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(screen.queryByTestId('upload-progress')).toBeNull();

    fireEvent.click(screen.getByTestId('upload-view-model'));
    expect(screen.getByTestId('model-route')).toBeInTheDocument();
    expect(screen.getByTestId('model-route')).toHaveAttribute('data-id', 'm-123');
  });

  it('shows the server error on a 400 response and allows a retry that succeeds', async () => {
    renderUpload();
    await fillReadyToUpload();

    await act(async () => {
      fireEvent.click(screen.getByTestId('upload-submit'));
    });
    await act(async () => {
      FakeXHR.instances[0]!.respond(400, { error: 'Name required' });
    });

    expect(screen.getByTestId('upload-error')).toHaveTextContent(
      'Name required',
    );
    expect(screen.getByTestId('upload-submit')).toBeEnabled();
    expect(screen.queryByTestId('upload-success')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByTestId('upload-submit'));
    });
    expect(FakeXHR.instances).toHaveLength(2);

    await act(async () => {
      FakeXHR.instances[1]!.respond(201, { id: 'm-456', name: 'Dragon' });
    });
    await screen.findByTestId('upload-success');
  });

  it('ignores a duplicate submit click while an upload is in flight', async () => {
    renderUpload();
    await fillReadyToUpload();

    await act(async () => {
      fireEvent.click(screen.getByTestId('upload-submit'));
      fireEvent.click(screen.getByTestId('upload-submit'));
      fireEvent.click(screen.getByTestId('upload-submit'));
    });

    expect(FakeXHR.instances).toHaveLength(1);
    expect(screen.getByTestId('upload-submit')).toBeDisabled();
  });

  it('reports network failure and keeps the selection for retry', async () => {
    renderUpload();
    await fillReadyToUpload();

    await act(async () => {
      fireEvent.click(screen.getByTestId('upload-submit'));
    });
    await act(async () => {
      FakeXHR.instances[0]!.failNetwork();
    });

    expect(screen.getByTestId('upload-error')).toHaveTextContent(
      /check your connection/i,
    );
    expect(screen.getByTestId('upload-filename')).toHaveTextContent(
      'Dragon.glb',
    );
    expect(screen.getByTestId('upload-submit')).toBeEnabled();
  });

  it('releases the preview blob URL when the selected file is removed', async () => {
    renderUpload();
    await selectValidFile();
    expect(await screen.findByTestId('upload-preview')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('upload-remove-file'));
    });

    expect(screen.queryByTestId('upload-preview')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    expect(screen.queryByTestId('upload-file-card')).toBeNull();
  });

  it('redirects to login when unauthenticated', () => {
    useAuthStore.setState({ token: null, isAuthenticated: false });
    renderUpload();

    expect(screen.getByTestId('login-route')).toBeInTheDocument();
    expect(screen.queryByTestId('upload-dropzone')).toBeNull();
  });
});
