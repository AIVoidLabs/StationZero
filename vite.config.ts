import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { levelSavePlugin } from './tools/vite-level-save.mjs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  plugins: [levelSavePlugin()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
