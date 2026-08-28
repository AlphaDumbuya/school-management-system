/**
 * CardPdfExporter
 * Renders a card (front + optional back) off-screen using the SAME
 * VisualIdCardRenderer shown on screen, captures each side to a high-res
 * PNG via html-to-image, and assembles a card-sized PDF with jsPDF.
 *
 * This guarantees the downloaded PDF is a pixel-faithful copy of the
 * on-screen card — one page per printed side, correctly sized (no A4
 * page, no blank second page).
 */

import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { VisualIdCardRenderer, VisualCardUserData } from './VisualIdCardRenderer';
import { CardFormat, TemplateConfig } from '@services/idCardService';

// Physical card dimensions in millimetres (ISO/IEC 7810 ID-1 for PVC).
const CARD_MM: Record<CardFormat, { w: number; h: number }> = {
  pvc: { w: 85.6, h: 53.98 },
  badge: { w: 101.6, h: 152.4 },
};

// Render width (px) for capture — high enough for crisp print output.
const CAPTURE_WIDTH_PX = 1010; // ~300 DPI at 85.6mm

export interface CardExportData {
  config: TemplateConfig;
  format: CardFormat;
  user: VisualCardUserData;
  logoUrl?: string;
  fileName: string;
}

export interface CardPdfExporterHandle {
  export: (data: CardExportData) => Promise<void>;
}

async function waitForImages(node: HTMLElement) {
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
    )
  );
  // Allow fonts/SVG to settle
  await new Promise((r) => setTimeout(r, 120));
}

export const CardPdfExporter = forwardRef<CardPdfExporterHandle, {}>((_props, ref) => {
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<CardExportData | null>(null);
  const resolverRef = useRef<(() => void) | null>(null);

  const isDouble = data?.config?.printSides === 'double';

  useImperativeHandle(ref, () => ({
    export: (payload: CardExportData) =>
      new Promise<void>((resolve, reject) => {
        setData(payload);
        // Wait for the hidden nodes to render, then capture.
        // A short delay lets React commit + layout complete.
        setTimeout(async () => {
          try {
            // Lazy-load heavy deps only when a download is triggered.
            const [{ toPng }, { jsPDF }] = await Promise.all([
              import('html-to-image'),
              import('jspdf'),
            ]);

            const dims = CARD_MM[payload.format];
            // Build the page with an explicit orientation string. jsPDF reorders
            // the `format` array based on orientation, so we always pass the
            // dimensions in portrait order [min, max] and let the orientation
            // flag rotate it — this avoids the tiling/duplication that happens
            // when format and orientation disagree.
            const isLandscape = dims.w >= dims.h;
            const shortSide = Math.min(dims.w, dims.h);
            const longSide = Math.max(dims.w, dims.h);
            const pdf = new jsPDF({
              orientation: isLandscape ? 'landscape' : 'portrait',
              unit: 'mm',
              format: [shortSide, longSide],
            });

            // Use the page's real drawable size for placement.
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();

            const capture = async (node: HTMLElement) => {
              await waitForImages(node);
              return toPng(node, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: '#ffffff',
              });
            };

            if (frontRef.current) {
              const frontPng = await capture(frontRef.current);
              pdf.addImage(frontPng, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
            }

            if (payload.config?.printSides === 'double' && backRef.current) {
              pdf.addPage([shortSide, longSide], isLandscape ? 'landscape' : 'portrait');
              const backPng = await capture(backRef.current);
              pdf.addImage(backPng, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), undefined, 'FAST');
            }

            pdf.save(payload.fileName);
            resolve();
          } catch (err) {
            reject(err);
          } finally {
            setData(null);
          }
        }, 200);
      }),
  }));

  if (!data) return null;

  // Off-screen render container — positioned far off view, not display:none
  // (display:none would give html-to-image a zero-size node).
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        left: -100000,
        top: 0,
        pointerEvents: 'none',
        opacity: 1,
        zIndex: -1,
      }}
    >
      <div ref={frontRef} style={{ width: CAPTURE_WIDTH_PX }}>
        <VisualIdCardRenderer
          config={data.config}
          format={data.format}
          user={data.user}
          logoUrl={data.logoUrl}
          side="front"
          widthPx={CAPTURE_WIDTH_PX}
          readonly
        />
      </div>
      {isDouble && (
        <div ref={backRef} style={{ width: CAPTURE_WIDTH_PX }}>
          <VisualIdCardRenderer
            config={data.config}
            format={data.format}
            user={data.user}
            logoUrl={data.logoUrl}
            side="back"
            widthPx={CAPTURE_WIDTH_PX}
            readonly
          />
        </div>
      )}
    </div>
  );
});

CardPdfExporter.displayName = 'CardPdfExporter';
