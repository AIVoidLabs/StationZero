import { defineConfig } from 'vite';

export default defineConfig({
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
