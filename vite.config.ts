import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'es2022',
    sourcemap: false,
  },
  server: {
    port: 5180,
    open: false,
    watch: {
      ignored: ['**/.playwright-cli/**'],
    },
  },
});
