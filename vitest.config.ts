import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: false, // run sequentially to avoid database transaction concurrency conflicts
    alias: {
      '@shared': path.resolve(__dirname, 'packages/shared/src'),
      '@database': path.resolve(__dirname, 'packages/database/src'),
    },
  },
});
