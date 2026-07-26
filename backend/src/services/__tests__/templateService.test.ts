import { describe, it, expect } from 'vitest';
import { TemplateService } from '../templateService';
import { AppError } from '../../middleware/errorHandler';

describe('TemplateService Layout Validation', () => {
  const mockDb: any = {};
  const service = new TemplateService(mockDb);

  it('should auto-clamp QR code position if slightly exceeding landscape PVC bounds', () => {
    const layout: any = {
      photoPosition: { x: 5, y: 12, width: 25, height: 30 },
      namePosition: { x: 34, y: 14 },
      rolePosition: { x: 34, y: 24 },
      idPosition: { x: 34, y: 31 },
      qrCodePosition: { x: 75, y: 40, size: 18 }, // 75 + 18 = 93 > 85.6
      barcodePosition: { x: 34, y: 38 },
    };

    // Access private method for unit testing
    (service as any).validateLayoutConfig(layout, 'pvc');

    // QR code position should be clamped safely to 85.6 - 18 = 67.6
    expect(layout.qrCodePosition.x).toBeLessThanOrEqual(85.6 - 18);
    expect(layout.qrCodePosition.y).toBeLessThanOrEqual(53.98 - 18);
  });

  it('should support portrait PVC dimensions dynamically', () => {
    const layout: any = {
      orientation: 'portrait',
      photoPosition: { x: 10, y: 15, width: 30, height: 35 },
      namePosition: { x: 10, y: 55 },
      rolePosition: { x: 10, y: 62 },
      idPosition: { x: 10, y: 70 },
      qrCodePosition: { x: 15, y: 65, size: 18 }, // y=65 > 53.98, valid for portrait (height 85.6)
      barcodePosition: { x: 10, y: 78 },
    };

    expect(() => (service as any).validateLayoutConfig(layout, 'pvc')).not.toThrow();
    expect(layout.qrCodePosition.y).toBe(65);
  });

  it('should support badge format dimensions (101.6mm x 152.4mm)', () => {
    const layout: any = {
      photoPosition: { x: 25, y: 20, width: 50, height: 60 },
      namePosition: { x: 10, y: 90 },
      rolePosition: { x: 10, y: 102 },
      idPosition: { x: 10, y: 110 },
      qrCodePosition: { x: 38, y: 120, size: 25 }, // y=120, size=25 -> 145 <= 152.4
      barcodePosition: { x: 10, y: 140 },
    };

    expect(() => (service as any).validateLayoutConfig(layout, 'badge')).not.toThrow();
    expect(layout.qrCodePosition.y).toBe(120);
  });
});
