import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        proxy: {
            '/uploads': 'http://localhost:3001',
        },
    },
    // No build.manualChunks: with the viewer stack lazy-loaded (ModelViewer and
    // UploadPreview dynamic imports), Rollup's natural chunking keeps three,
    // fiber, and drei in async chunks while react stays eager.
});
