import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist',
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  skipNodeModulesBundle: true, // keep node_modules as external requires
  treeshake: true,
  target: 'node18',
  // Resolve TypeScript path aliases
  tsconfig: './tsconfig.json',
});
