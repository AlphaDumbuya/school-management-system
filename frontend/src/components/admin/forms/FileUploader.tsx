/**
 * FileUploader — Shared file upload component
 * Supports: drag & drop, click to browse, webcam capture, preview for images.
 * Uploads to /api/v1/uploads and returns the file URL.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2, Camera } from 'lucide-react';
import apiClient from '@lib/apiClient';
import { CameraCapture, type CameraFacing, type CameraGuide } from './CameraCapture';

/** Convert a data URL to a Blob for multipart upload. */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(header)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Persist a file to durable storage via the backend, returning the hosted URL.
 * Falls back to the provided data URL (base64) if the upload fails, so the user
 * is never blocked — fine for small images like logos/photos.
 */
async function uploadToServer(blob: Blob, filename: string, fallbackDataUrl: string): Promise<string> {
  try {
    const form = new FormData();
    form.append('file', blob, filename);
    // Let axios set the multipart boundary (override the instance JSON default).
    const res: any = await apiClient.post('/api/v1/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const url = res?.data?.url ?? res?.data?.data?.url;
    if (typeof url !== 'string' || url.length === 0) return fallbackDataUrl;
    // A stored URL this device can't display (blocked cross-origin, a
    // "localhost" URL opened on a phone, storage down) would save a broken
    // photo. Keep the image inline instead so it shows everywhere.
    if (url.startsWith('data:')) return url;
    return (await imageLoads(url)) ? url : fallbackDataUrl;
  } catch {
    return fallbackDataUrl;
  }
}

/** True when the browser can actually display the image at `url`. */
function imageLoads(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ''; resolve(false); }, timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img.naturalWidth > 0); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}

/** Compress image to fit within maxSize pixels and quality */
function compressImage(
  file: File,
  maxSize: number = 300,
  quality: number = 0.7,
  outType: 'image/jpeg' | 'image/png' = 'image/jpeg',
  removeBg: boolean = false,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      // Scale down to maxSize
      if (width > height) {
        if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; }
      } else {
        if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);

      // Background removal — knock out light/near-white pixels to transparent.
      // Works well for dark ink (signatures/stamps) photographed on light paper.
      // Forces PNG output so transparency is preserved.
      if (removeBg) {
        try {
          const imgData = ctx.getImageData(0, 0, width, height);
          const d = imgData.data;
          // Pixels brighter than this luminance become fully transparent; a soft
          // band just below it is partially faded to avoid a hard cut-out edge.
          const HARD = 210; // >= this → transparent
          const SOFT = 170; // between SOFT..HARD → gradual alpha
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum >= HARD) {
              d[i + 3] = 0;
            } else if (lum > SOFT) {
              // Linear fade from opaque (at SOFT) to transparent (at HARD).
              const a = 1 - (lum - SOFT) / (HARD - SOFT);
              d[i + 3] = Math.round(d[i + 3] * a);
            }
          }
          ctx.putImageData(imgData, 0, 0);
        } catch {
          // getImageData can throw on tainted canvases — fall back to as-is.
        }
        resolve(canvas.toDataURL('image/png'));
        return;
      }

      // PNG keeps transparency (ideal for signatures/stamps); JPEG is smaller.
      resolve(canvas.toDataURL(outType, quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

interface FileUploaderProps {
  value?: string; // current file URL
  onChange: (url: string) => void;
  label?: string;
  accept?: string; // e.g. "image/*" or "image/*,.pdf"
  maxSizeMB?: number;
  placeholder?: string;
  helperText?: string;
  error?: string;
  previewType?: 'image' | 'file'; // how to show preview
  enableCamera?: boolean; // show camera capture option
  /** Camera to open first. Default: back camera (falls back to the webcam on laptops). */
  cameraFacing?: CameraFacing;
  /** Crop for camera shots, width / height. Default 3/4 (passport photo). Use 1 for logos. */
  cameraAspect?: number;
  /** Camera overlay: face oval (default), frame (documents/logos) or none. */
  cameraGuide?: CameraGuide;
  className?: string;
  /**
   * For small images (signatures, stamps, logos), store the compressed image
   * INLINE as a base64 data URL instead of a server /storage URL. This makes the
   * value render reliably everywhere (preview, report card, PDF) with no
   * dependency on the storage endpoint resolving. Ignored for non-image files.
   */
  inlineImage?: boolean;
  /**
   * Knock out light/near-white background pixels to transparent on upload.
   * Ideal for signatures/stamps photographed on paper. Forces PNG output and
   * implies inline storage. Ignored for non-image files.
   */
  removeBackground?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  value,
  onChange,
  label,
  accept = 'image/*',
  maxSizeMB = 5,
  placeholder = 'Click or drag to upload',
  helperText,
  error,
  previewType = 'image',
  enableCamera = false,
  cameraFacing = 'environment',
  cameraAspect = 3 / 4,
  cameraGuide = 'face',
  className = '',
  inlineImage = false,
  removeBackground = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  // When an image preview fails to load (e.g. a non-renderable file was uploaded
  // under previewType='image'), fall back to a filename chip instead of a blank box.
  const [imgFailed, setImgFailed] = useState(false);

  // Reset the image-failed flag whenever the value changes (new upload/removal).
  useEffect(() => { setImgFailed(false); }, [value]);

  const handleUpload = useCallback(async (file: File) => {
    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setUploadError(`File too large. Maximum ${maxSizeMB}MB allowed.`);
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const isImage = file.type.startsWith('image/');
      if (isImage) {
        // Compress large images first. For signatures/stamps we keep PNG to
        // preserve transparency; otherwise JPEG for smaller size. Background
        // removal forces PNG + inline so the cut-out renders everywhere.
        const keepPng = removeBackground || (inlineImage && file.type === 'image/png');
        const compressedDataUrl = await compressImage(
          file, 800, 0.9, keepPng ? 'image/png' : 'image/jpeg', removeBackground,
        );
        if (inlineImage || removeBackground) {
          // Store inline — renders reliably everywhere with no /storage dependency.
          onChange(compressedDataUrl);
        } else {
          // Persist to durable storage; fall back to the data URL on failure.
          const blob = dataUrlToBlob(compressedDataUrl);
          const url = await uploadToServer(blob, file.name || 'image.jpg', compressedDataUrl);
          onChange(url);
        }
      } else {
        // Non-image (PDF/DOC): upload as-is; no client fallback (too large for base64).
        const form = new FormData();
        form.append('file', file, file.name);
        const res: any = await apiClient.post('/api/v1/uploads', form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const url = res?.data?.url ?? res?.data?.data?.url;
        if (!url) throw new Error('Upload failed. Please try again.');
        onChange(url);
      }
      setIsUploading(false);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload file');
      setIsUploading(false);
    }
  }, [maxSizeMB, onChange, inlineImage, removeBackground]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
  };

  // ── Camera (shared full-screen CameraCapture) ──
  const onCameraCapture = (file: File) => {
    setCameraOpen(false);
    void handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleRemove = () => {
    onChange('');
    setUploadError(null);
  };

  const displayError = error || uploadError;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      )}

      {/* Preview or Upload Zone */}
      {value && value.length > 10 ? (
        // File already uploaded — show preview
        <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800">
          {previewType === 'image' && !imgFailed ? (
            <div className="w-full h-32 sm:h-40 flex items-center justify-center bg-white">
              <img
                src={value}
                alt="Uploaded"
                className="max-h-full max-w-full object-contain rounded-lg"
                onError={() => setImgFailed(true)}
              />
            </div>
          ) : (
            // Right padding keeps the text clear of the Retake / Remove buttons.
            <div className="pl-4 pr-24 py-3 flex items-center gap-3 min-h-[56px]">
              <FileText size={20} className="text-blue-500 flex-shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-gray-700 dark:text-gray-300 truncate">
                  {value.startsWith('data:') ? 'Uploaded file' : value.split('/').pop()}
                </span>
                {previewType === 'image' && imgFailed && (
                  <span className="block text-[11px] text-amber-600 dark:text-amber-400">
                    This image can't be shown. Retake it or upload it again.
                  </span>
                )}
              </span>
            </div>
          )}
          {/* Retake (camera) + Remove */}
          <div className="absolute top-2 right-2 flex items-center gap-1.5">
            {enableCamera && previewType === 'image' && (
              <button
                type="button"
                onClick={() => { setUploadError(null); setCameraOpen(true); }}
                className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors"
                title="Retake with camera"
                aria-label="Retake with camera"
              >
                <Camera size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={handleRemove}
              className="p-2 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
              title="Remove"
              aria-label="Remove file"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        // Upload zone
        <>
            <div
              role="button"
              tabIndex={0}
              aria-label={label ? `${label}: ${placeholder}` : placeholder}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative flex flex-col items-center justify-center gap-2 px-4 py-6 sm:py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  : displayError
                    ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/10'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-600 bg-gray-50 dark:bg-gray-800/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/10'
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 size={24} className="text-blue-500 animate-spin" />
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Uploading...</p>
                </>
              ) : (
                <>
                  {previewType === 'image' ? (
                    <ImageIcon size={28} className="text-gray-400 dark:text-gray-500" />
                  ) : (
                    <Upload size={28} className="text-gray-400 dark:text-gray-500" />
                  )}
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">{placeholder}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Max {maxSizeMB}MB · {accept === 'image/*' ? 'JPEG, PNG, WebP' : 'Supported formats'}</p>
                </>
              )}

              <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

          {/* Camera button — below the upload zone */}
          {enableCamera && !isUploading && (
            <button
              type="button"
              onClick={() => { setUploadError(null); setCameraOpen(true); }}
              className="mt-1.5 w-full flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Camera size={14} /> Take Photo
            </button>
          )}
        </>
      )}

      {enableCamera && (
        <CameraCapture
          open={cameraOpen}
          onClose={() => setCameraOpen(false)}
          onCapture={onCameraCapture}
          facing={cameraFacing}
          aspect={cameraAspect}
          guide={cameraGuide}
          title={label ? `${label}: take a photo` : 'Take a photo'}
        />
      )}

      {displayError && <p className="text-xs text-red-600 dark:text-red-400">{displayError}</p>}
      {!displayError && helperText && <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
};

export default FileUploader;
