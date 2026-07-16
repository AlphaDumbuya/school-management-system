/**
 * FileUploader — Shared file upload component
 * Supports drag & drop, click to browse, preview for images.
 * Uploads to /api/v1/uploads and returns the file URL.
 */

import React, { useRef, useState, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { axiosInstance } from '@lib/apiClient';

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
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = useCallback(async (file: File) => {
    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setUploadError(`File too large. Maximum ${maxSizeMB}MB allowed.`);
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axiosInstance.post('/api/v1/uploads', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const fileUrl = response.data?.data?.url;
      if (fileUrl) {
        onChange(fileUrl);
      } else {
        throw new Error('No URL returned');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Upload failed';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  }, [maxSizeMB, onChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so same file can be re-selected
    if (inputRef.current) inputRef.current.value = '';
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

      {displayError && <p className="text-xs text-red-600 dark:text-red-400">{displayError}</p>}
      {!displayError && helperText && <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
};

export default FileUploader;
