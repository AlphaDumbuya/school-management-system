/**
 * FileUploader — Shared file upload component
 * Supports: drag & drop, click to browse, webcam capture, preview for images.
 * Uploads to /api/v1/uploads and returns the file URL.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2, Camera, RotateCcw } from 'lucide-react';
import apiClient from '@lib/apiClient';

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
    return typeof url === 'string' && url.length > 0 ? url : fallbackDataUrl;
  } catch {
    return fallbackDataUrl;
  }
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
  className = '',
  inlineImage = false,
  removeBackground = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
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

  // ── Camera Functions ──
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setStream(mediaStream);
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      setUploadError('Camera access denied. Please allow camera permission.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopCamera();
        handleUpload(file);
      }
    }, 'image/jpeg', 0.85);
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
            <div className="px-4 py-3 flex items-center gap-3">
              <FileText size={20} className="text-blue-500 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                {value.startsWith('data:') ? 'Uploaded file' : value.split('/').pop()}
              </span>
              {previewType === 'image' && imgFailed && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 flex-shrink-0">Preview unavailable — use a PNG/JPG image</span>
              )}
            </div>
          )}
          {/* Remove button */}
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
            title="Remove"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        // Upload zone
        <>
          {/* Camera view */}
          {cameraActive ? (
            <div className="rounded-lg border-2 border-blue-500 overflow-hidden bg-black">
              <div className="relative aspect-[3/4] max-h-[160px] mx-auto">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                {/* Frame guide overlay */}
                <div className="absolute inset-2 border border-white/50 rounded pointer-events-none" />
              </div>
              <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 bg-gray-900">
                <button type="button" onClick={capturePhoto} className="flex-1 px-2 py-1 bg-blue-600 text-white text-[10px] font-bold rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 min-w-0">
                  <Camera size={11} /> Capture
                </button>
                <button type="button" onClick={stopCamera} className="flex-1 px-2 py-1 bg-gray-700 text-gray-300 text-[10px] font-bold rounded hover:bg-gray-600 transition-colors min-w-0">
                  Cancel
                </button>
              </div>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          ) : (
            <div
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
          )}

          {/* Camera button — below the upload zone */}
          {enableCamera && !cameraActive && !isUploading && (
            <button
              type="button"
              onClick={startCamera}
              className="mt-1.5 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-[10px] font-semibold text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Camera size={11} /> Use Camera
            </button>
          )}
        </>
      )}

      {displayError && <p className="text-xs text-red-600 dark:text-red-400">{displayError}</p>}
      {!displayError && helperText && <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
};

export default FileUploader;
