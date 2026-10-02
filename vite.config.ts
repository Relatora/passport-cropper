import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages serves the site from /passport-cropper/ (and `vite preview` mirrors
  // that); the dev server stays at /.
  base: command === 'build' || isPreview ? '/passport-cropper/' : '/',
  plugins: [react()],
  worker: { format: 'es' },
  // OpenCV.js is a single 13 MB file (WASM inlined); it lives in its own worker chunk.
  build: { chunkSizeWarningLimit: 15000 },
}));
