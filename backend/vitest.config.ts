import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Swaps in TEST_DATABASE_URL and clears any destructive override.
    setupFiles: ['./src/test/setupSafety.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@config': path.resolve(__dirname, './src/config'),
      '@controllers': path.resolve(__dirname, './src/controllers'),
      '@services': path.resolve(__dirname, './src/services'),
      '@models': path.resolve(__dirname, './src/models'),
      '@middleware': path.resolve(__dirname, './src/middleware'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
});
