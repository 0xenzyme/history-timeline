import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 5180,
    open: false,
  },
});
