/**
 * PDF Browser launcher
 * =====================
 * Provides a Puppeteer browser that works both locally and on serverless
 * (Vercel / AWS Lambda) via @sparticuz/chromium.
 *
 * - Production / serverless: uses @sparticuz/chromium's bundled headless binary.
 * - Local development: uses a locally-installed Chrome/Edge if found.
 *
 * Set PUPPETEER_EXECUTABLE_PATH to override the local browser path.
 */

import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'fs';
import { logger } from './logger.js';

const IS_SERVERLESS = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

// Common local Chrome/Edge locations by platform (dev fallback)
const LOCAL_CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  // Windows
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean) as string[];

function findLocalChrome(): string | null {
  for (const p of LOCAL_CHROME_CANDIDATES) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function launchPdfBrowser(): Promise<Browser> {
  if (IS_SERVERLESS) {
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  // Local dev
  const executablePath = findLocalChrome();
  if (!executablePath) {
    throw new Error(
      'No local Chrome/Edge found for PDF generation. Install Google Chrome, ' +
      'or set PUPPETEER_EXECUTABLE_PATH to a Chromium executable.',
    );
  }

  logger.debug(`[pdfBrowser] Using local browser at ${executablePath}`);
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

/**
 * Render a full HTML document to a PDF buffer.
 * The HTML must include its own <style> — no external CSS is loaded.
 */
export async function htmlToPdf(
  html: string,
  opts: { landscape?: boolean } = {},
): Promise<Buffer> {
  let browser: Browser | null = null;
  try {
    browser = await launchPdfBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      landscape: opts.landscape ?? true,
      printBackground: true,
      // margin 0 + no display header/footer → clean pages, no browser chrome
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      displayHeaderFooter: false,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close();
  }
}
