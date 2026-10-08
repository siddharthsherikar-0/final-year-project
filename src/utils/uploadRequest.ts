const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

export interface UploadModelParams {
  file: File;
  name: string;
  description: string;
  category: string;
  tags: string;
  token: string | null;
  /**
   * Data URL of the studio preview rendered once from the uploaded file.
   * Omitted when generation failed - the server then stores an empty
   * thumbnailUrl and the gallery falls back to the placeholder.
   */
  thumbnail?: string | null;
}

export interface UploadedModelSummary {
  id: string;
  name: string;
}

export type UploadProgressHandler = (percent: number | null) => void;

export function uploadModel(
  params: UploadModelParams,
  onProgress: UploadProgressHandler,
): Promise<UploadedModelSummary> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${params.token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(Math.min(percent, 99));
      } else {
        onProgress(null);
      }
    };

    xhr.onload = () => {
      type UploadResponse = { id?: string; name?: string; error?: string };
      let data: UploadResponse | null = null;
      try {
        data = JSON.parse(xhr.responseText) as UploadResponse;
      } catch {
        // Non-JSON response body — keep data null so the branch below
        // reports a status-based error.
      }
      if (xhr.status >= 200 && xhr.status < 300 && data?.id) {
        onProgress(100);
        resolve({ id: data.id, name: data.name ?? params.name });
      } else {
        reject(
          new Error(
            data?.error ??
              `Upload failed${xhr.status ? ` (${xhr.status})` : ''}`,
          ),
        );
      }
    };

    xhr.onerror = () => {
      reject(new Error('Upload failed — check your connection and try again'));
    };

    xhr.onabort = () => {
      reject(new Error('Upload was cancelled'));
    };

    const formData = new FormData();
    formData.append('model', params.file);
    formData.append('name', params.name);
    formData.append('description', params.description);
    formData.append('category', params.category);
    formData.append('tags', params.tags);
    if (params.thumbnail) {
      formData.append('thumbnail', params.thumbnail);
    }
    xhr.send(formData);
  });
}
