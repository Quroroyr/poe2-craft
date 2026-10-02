import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'tests/**/*.test.ts', 'apps/web/src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
  // Web tests render components to static markup: React's automatic JSX runtime and the app's "@/" alias.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) } },
});
