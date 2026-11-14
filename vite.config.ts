import { defineConfig } from 'vite';
import { levelSavePlugin } from './tools/vite-level-save.mjs';

export default defineConfig({
  plugins: [levelSavePlugin()],
  base: './',
  publicDir: 'assets',
  server: {
    port: 5173,
    open: false,
    watch: {
      ignored: [
        '**/.opencode/**',
        '**/node_modules/**',
        '**/.git/**',
      ],
    },
  },
  build: {
    target: 'es2020'
  }
});
