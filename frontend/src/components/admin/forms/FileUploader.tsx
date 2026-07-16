/**
 * FileUploader — Shared file upload component
 * Supports: drag & drop, click to browse, webcam capture, preview for images.
 * Uploads to /api/v1/uploads and returns the file URL.
 */

import React, { useRef, useState, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2, Camera, RotateCcw } from 'lucide-react';

/** Compress image to fit within maxSize pixels and quality */
function compressImage(file: File, maxSize: number = 300, quality: number = 0.7): Promise<string> {
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
      resolve(canvas.toDataURL('image/jpeg', quality));
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
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setUploadError(`File too large. Maximum ${maxSizeMB}MB allowed.`);
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      // Compress and convert to base64 data URL
      const compressed = await compressImage(file, 300, 0.7);
      onChange(compressed);
      setIsUploading(false);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to process image');
      setIsUploading(false);
    }
  }, [maxSizeMB, onChange]);

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
      {value ? (
        // File already uploaded — show preview
        <div className="relative rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800">
          {previewType === 'image' ? (
            <div className="w-full h-32 sm:h-40 flex items-center justify-center">
              <img
                src={value}
                alt="Uploaded"
                className="max-h-full max-w-full object-contain rounded-lg"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          ) : (
            <div className="px-4 py-3 flex items-center gap-3">
              <FileText size={20} className="text-blue-500 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">{value.split('/').pop()}</span>
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
