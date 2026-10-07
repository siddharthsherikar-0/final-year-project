import '@testing-library/jest-dom/vitest';

// jsdom does not implement Blob.arrayBuffer()/text(); provide FileReader-backed
// equivalents so client-side metadata extraction works under test.
if (typeof Blob.prototype.arrayBuffer !== 'function') {
  Blob.prototype.arrayBuffer = function arrayBuffer(
    this: Blob,
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () =>
        reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsArrayBuffer(this);
    });
  };
}

if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function text(this: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () =>
        reject(reader.error ?? new Error('Failed to read file'));
      reader.readAsText(this);
    });
  };
}
