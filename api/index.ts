/**
 * Vercel Serverless Entry Point
 *
 * Vercel routes all /api/* requests to this file.
 * We import the compiled Express app from the backend dist folder.
 *
 * Build order: backend is compiled first via vercel.json buildCommand,
 * then the frontend. The serverless function picks up backend/dist/index.js.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Dynamically import the built app so Vercel bundles it correctly
// The backend build outputs to backend/dist/index.js
let appPromise: Promise<any>;

function getApp() {
  if (!appPromise) {
    appPromise = import('../backend/dist/index.js').then((mod) => mod.default || mod.app || mod);
  }
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const app = await getApp();
  // Express app is callable as a request handler
  return app(req, res);
}
