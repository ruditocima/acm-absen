import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    minify: 'esbuild', // Memastikan minifikasi otomatis pada JS dan CSS untuk mempercepat loading
    sourcemap: false,
  },
});