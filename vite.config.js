import { defineConfig } from 'vite';

// base './' lets the built site work from any sub-path (e.g. GitHub Pages /repo/).
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1500 },
});
