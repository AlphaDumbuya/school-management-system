import { defineConfig } from 'tsup';

export default defineConfig({
  // Two output groups, both rooted at `src` so paths stay stable:
  //   - src/index.ts                → dist/index.js         (the bundled app)
  //   - src/database/migrations/*   → dist/database/migrations/*.js
  //   - src/database/seeds/*        → dist/database/seeds/*.js
  //
  // Migrations/seeds are loaded DYNAMICALLY by knex at runtime (never imported
  // by index.ts), so they must be emitted as their own per-file outputs —
  // otherwise `knex migrate:latest` in production (which reads
  // ./dist/database/migrations/*.js) finds nothing and the schema silently
  // drifts behind the code (this is what left refresh_tokens.token_hash missing
  // in prod and broke login). Keeping every entry under `src/` means tsup uses
  // `src` as the common base, so outputs land at dist/… (NOT dist/src/…),
  // preserving dist/index.js for api/index.ts and vercel.json.
  entry: [
    'src/index.ts',
    'src/database/migrations/*.ts',
    'src/database/seeds/*.ts',
  ],
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
