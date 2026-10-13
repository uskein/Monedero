import { defineConfig } from 'vitest/config'; // SSOT del bloque `test` (evita la duplicación de instancias de vite en el workspace)
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: [
      {
        find: /^@monedero\/tokens$/,
        replacement: fileURLToPath(new URL('../../shared/tokens/src/index.ts', import.meta.url)),
      },
      {
        find: /^@monedero\/tokens\/tokens\.css$/,
        replacement: fileURLToPath(new URL('../../shared/tokens/src/tokens.css', import.meta.url)),
      },
      {
        find: /^@monedero\/export-contract$/,
        replacement: fileURLToPath(new URL('../../shared/export-contract/src/index.ts', import.meta.url)),
      },
    ],
  },
  server: {
    port: 5173,
    // ADR-001: sin proxies a ningún backend. Todo es local.
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
    },
  },
});
