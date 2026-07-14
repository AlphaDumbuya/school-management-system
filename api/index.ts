/**
 * Vercel Serverless Entry Point
 */
import type { IncomingMessage, ServerResponse } from 'http';

let app: any = null;
let loadError: string | null = null;

async function getApp() {
  if (app) return app;
  if (loadError) return null;
  try {
    const mod = await import('../backend/dist/index.js');
    app = mod.default;
    return app;
  } catch (e: any) {
    loadError = e?.message || String(e);
    console.error('Failed to load app:', loadError, e?.stack);
    return null;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const expressApp = await getApp();

  if (!expressApp) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'App failed to load',
      message: loadError,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        HAS_DB: !!process.env.DATABASE_URL,
        HAS_JWT: !!process.env.JWT_SECRET,
      }
    }));
    return;
  }

  return expressApp(req, res);
}
