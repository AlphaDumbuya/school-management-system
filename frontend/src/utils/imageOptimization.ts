/**
 * Image Optimization Utility - Phase 20
 * Handles image optimization, lazy loading, and format conversion
 */

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  lazy?: boolean;
  placeholder?: string;
}

/**
 * Get optimized image URL
 */
export const getOptimizedImageUrl = (
  originalUrl: string,
  options: ImageOptimizationOptions = {}
): string => {
  const {
    maxWidth = 800,
    maxHeight = 600,
    quality = 80,
    format = 'webp',
  } = options;

  // For API URLs, add optimization query parameters
  if (originalUrl.startsWith('/api/')) {
    const separator = originalUrl.includes('?') ? '&' : '?';
    return `${originalUrl}${separator}w=${maxWidth}&h=${maxHeight}&q=${quality}&fmt=${format}`;
  }

  // For external URLs, return as-is or add to CDN if configured
  return originalUrl;
};

/**
 * Generate responsive image srcSet
 */
export const generateResponsiveSrcSet = (
  imageUrl: string,
  quality: number = 80
): string => {
  const sizes = [320, 640, 960, 1280, 1920];

  return sizes
    .map(
      (width) =>
        `${getOptimizedImageUrl(imageUrl, { maxWidth: width, quality })} ${width}w`
    )
    .join(', ');
};

/**
 * Generate image sizes attribute
 */
export const generateImageSizes = (): string => {
  return '(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw';
};

/**
 * Preload image
 */
export const preloadImage = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
};

/**
 * Check if browser supports WebP
 */
export const supportsWebP = async (): Promise<boolean> => {
  if (!self.createImageBitmap) {
    return false;
  }

  const webp = new Blob(
    [
      new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38,
        0x20, 0x18, 0x00, 0x00, 0x00, 0x30, 0x01, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00,
        0x02, 0x00, 0x34, 0x25, 0xa4, 0x00, 0x03, 0x70, 0x00, 0xfe, 0xfb, 0x94, 0x00, 0x00,
      ]),
    ],
    { type: 'image/webp' }
  );

  try {
    await createImageBitmap(webp);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get best image format based on browser support
 */
export const getBestImageFormat = async (): Promise<'webp' | 'png' | 'jpeg'> => {
  const supportsWebPFormat = await supportsWebP();
  return supportsWebPFormat ? 'webp' : 'png';
};

/**
 * Compress image on client side
 */
export const compressImage = (
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: string;
  } = {}
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        let { width, height } = img;
        const maxWidth = options.maxWidth || 1920;
        const maxHeight = options.maxHeight || 1440;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        const quality = options.quality ?? 0.8;
        const format = options.format || 'image/jpeg';

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          format,
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
};

/**
 * Calculate image aspect ratio
 */
export const calculateAspectRatio = (width: number, height: number): string => {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);
  return `${width / divisor}/${height / divisor}`;
};

/**
 * Generate blurhash placeholder
 * Note: This is a simplified version. For production, use blurhash library
 */
export const generatePlaceholder = (
  width: number = 10,
  height: number = 10
): string => {
  // Return a data URL for a simple gradient placeholder
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#e0e0e0');
  gradient.addColorStop(1, '#f5f5f5');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return canvas.toDataURL('image/png');
};

/**
 * Lazy load image with intersection observer
 */
export const useLazyLoadImage = (
  imageElement: HTMLImageElement | null,
  {
    rootMargin = '50px',
    threshold = 0.01,
  } = {}
): void => {
  if (!imageElement || !('IntersectionObserver' in window)) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;

          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    },
    { rootMargin, threshold }
  );

  observer.observe(imageElement);
};

export default {
  getOptimizedImageUrl,
  generateResponsiveSrcSet,
  generateImageSizes,
  preloadImage,
  supportsWebP,
  getBestImageFormat,
  compressImage,
  calculateAspectRatio,
  generatePlaceholder,
  useLazyLoadImage,
};
