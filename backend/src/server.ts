/**
 * Server entry point for local development.
 * This file is NOT used by Vercel — Vercel uses api/index.ts which imports app directly.
 */
import app from './index.js';

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const server = app.listen(PORT, () => {
  console.info(`Server running on port ${PORT} in ${NODE_ENV} mode`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
