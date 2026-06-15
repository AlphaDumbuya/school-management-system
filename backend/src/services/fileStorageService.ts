/**
 * File Storage Service
 * 
 * Provides unified interface for file storage operations supporting:
 * - Local filesystem storage (development)
 * - S3-compatible storage (production - AWS S3, MinIO, DigitalOcean Spaces)
 * 
 * Features:
 * - Automatic storage provider selection based on environment
 * - File upload with validation (type, size)
 * - Secure URL generation with expiration
 * - File deletion and cleanup
 * - Support for PDF, image, and logo files
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import logger from '../utils/logger';

interface UploadOptions {
  folder?: string;
  filename?: string;
  contentType?: string;
  maxSize?: number; // in bytes
  allowedTypes?: string[];
}

interface UploadResult {
  url: string;
  filename: string;
  size: number;
  contentType: string;
}

enum StorageProvider {
  LOCAL = 'local',
  S3 = 's3'
}

class FileStorageService {
  private provider: StorageProvider;
  private s3Client?: S3Client;
  private s3Bucket?: string;
  private localStoragePath: string;
  private publicUrl: string;

  constructor() {
    // Determine storage provider from environment
    this.provider = (process.env.STORAGE_PROVIDER as StorageProvider) || StorageProvider.LOCAL;
    this.localStoragePath = process.env.LOCAL_STORAGE_PATH || './storage';
    this.publicUrl = process.env.PUBLIC_URL || 'http://localhost:3000';

    // Initialize S3 client if using S3
    if (this.provider === StorageProvider.S3) {
      const region = process.env.AWS_REGION || process.env.S3_REGION || 'us-east-1';
      const endpoint = process.env.S3_ENDPOINT; // For S3-compatible services
      
      this.s3Client = new S3Client({
        region,
        endpoint,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY || ''
        },
        forcePathStyle: !!endpoint // Required for MinIO and some S3-compatible services
      });
      
      this.s3Bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || '';
      
      if (!this.s3Bucket) {
        logger.warn('S3 storage configured but S3_BUCKET not set. Falling back to local storage.');
        this.provider = StorageProvider.LOCAL;
      }
    }

    // Ensure local storage directory exists
    if (this.provider === StorageProvider.LOCAL) {
      this.ensureLocalStorageExists();
    }

    logger.info(`File storage initialized with provider: ${this.provider}`);
  }

  /**
   * Ensure local storage directory exists
   */
  private async ensureLocalStorageExists(): Promise<void> {
    try {
      await fs.mkdir(this.localStoragePath, { recursive: true });
      await fs.mkdir(path.join(this.localStoragePath, 'id-cards'), { recursive: true });
      await fs.mkdir(path.join(this.localStoragePath, 'logos'), { recursive: true });
      await fs.mkdir(path.join(this.localStoragePath, 'photos'), { recursive: true });
      await fs.mkdir(path.join(this.localStoragePath, 'temp'), { recursive: true });
    } catch (error) {
      logger.error('Failed to create local storage directories', { error });
      throw new Error('Failed to initialize local storage');
    }
  }

  /**
   * Upload file to storage
   */
  async uploadFile(
    fileBuffer: Buffer,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const {
      folder = 'temp',
      filename,
      contentType = 'application/octet-stream',
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedTypes = []
    } = options;

    // Validate file size
    if (fileBuffer.length > maxSize) {
      throw new Error(`File size ${fileBuffer.length} exceeds maximum ${maxSize} bytes`);
    }

    // Validate content type
    if (allowedTypes.length > 0 && !allowedTypes.includes(contentType)) {
      throw new Error(`Content type ${contentType} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Generate filename if not provided
    const finalFilename = filename || this.generateFilename(contentType);
    const filePath = `${folder}/${finalFilename}`;

    try {
      if (this.provider === StorageProvider.S3) {
        return await this.uploadToS3(fileBuffer, filePath, contentType);
      } else {
        return await this.uploadToLocal(fileBuffer, filePath, contentType);
      }
    } catch (error) {
      logger.error('File upload failed', { error, filePath, provider: this.provider });
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload PDF file
   */
  async uploadPdf(pdfBuffer: Buffer, filename: string): Promise<UploadResult> {
    return this.uploadFile(pdfBuffer, {
      folder: 'id-cards',
      filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
      contentType: 'application/pdf',
      maxSize: 5 * 1024 * 1024, // 5MB for PDFs
      allowedTypes: ['application/pdf']
    });
  }

  /**
   * Upload logo image
   */
  async uploadLogo(imageBuffer: Buffer, filename: string, contentType: string): Promise<UploadResult> {
    return this.uploadFile(imageBuffer, {
      folder: 'logos',
      filename,
      contentType,
      maxSize: 5 * 1024 * 1024, // 5MB for logos
      allowedTypes: ['image/png', 'image/jpeg', 'image/jpg']
    });
  }

  /**
   * Upload user photo
   */
  async uploadPhoto(photoBuffer: Buffer, userId: string, contentType: string): Promise<UploadResult> {
    const ext = contentType.split('/')[1] || 'jpg';
    return this.uploadFile(photoBuffer, {
      folder: 'photos',
      filename: `user_${userId}.${ext}`,
      contentType,
      maxSize: 2 * 1024 * 1024, // 2MB for photos
      allowedTypes: ['image/png', 'image/jpeg', 'image/jpg']
    });
  }

  /**
   * Get file from storage
   */
  async getFile(filePath: string): Promise<Buffer> {
    try {
      if (this.provider === StorageProvider.S3) {
        return await this.getFromS3(filePath);
      } else {
        return await this.getFromLocal(filePath);
      }
    } catch (error) {
      logger.error('File retrieval failed', { error, filePath, provider: this.provider });
      throw new Error(`Failed to retrieve file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      if (this.provider === StorageProvider.S3) {
        await this.deleteFromS3(filePath);
      } else {
        await this.deleteFromLocal(filePath);
      }
      logger.info('File deleted', { filePath, provider: this.provider });
    } catch (error) {
      logger.error('File deletion failed', { error, filePath, provider: this.provider });
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate signed URL for temporary access (S3 only)
   */
  async generateSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    if (this.provider === StorageProvider.S3 && this.s3Client && this.s3Bucket) {
      try {
        const command = new GetObjectCommand({
          Bucket: this.s3Bucket,
          Key: filePath
        });
        
        return await getSignedUrl(this.s3Client, command, { expiresIn });
      } catch (error) {
        logger.error('Failed to generate signed URL', { error, filePath });
        throw new Error('Failed to generate signed URL');
      }
    }
    
    // For local storage, return direct URL
    return `${this.publicUrl}/storage/${filePath}`;
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      if (this.provider === StorageProvider.S3) {
        await this.getFromS3(filePath);
        return true;
      } else {
        const fullPath = path.join(this.localStoragePath, filePath);
        await fs.access(fullPath);
        return true;
      }
    } catch {
      return false;
    }
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Upload to S3
   */
  private async uploadToS3(
    fileBuffer: Buffer,
    filePath: string,
    contentType: string
  ): Promise<UploadResult> {
    if (!this.s3Client || !this.s3Bucket) {
      throw new Error('S3 client not initialized');
    }

    const command = new PutObjectCommand({
      Bucket: this.s3Bucket,
      Key: filePath,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'private' // Files are private, access via signed URLs
    });

    await this.s3Client.send(command);

    // Generate signed URL for immediate access
    const url = await this.generateSignedUrl(filePath);

    return {
      url,
      filename: path.basename(filePath),
      size: fileBuffer.length,
      contentType
    };
  }

  /**
   * Upload to local filesystem
   */
  private async uploadToLocal(
    fileBuffer: Buffer,
    filePath: string,
    contentType: string
  ): Promise<UploadResult> {
    const fullPath = path.join(this.localStoragePath, filePath);
    const directory = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, fileBuffer);

    const url = `${this.publicUrl}/storage/${filePath}`;

    return {
      url,
      filename: path.basename(filePath),
      size: fileBuffer.length,
      contentType
    };
  }

  /**
   * Get file from S3
   */
  private async getFromS3(filePath: string): Promise<Buffer> {
    if (!this.s3Client || !this.s3Bucket) {
      throw new Error('S3 client not initialized');
    }

    const command = new GetObjectCommand({
      Bucket: this.s3Bucket,
      Key: filePath
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('File not found');
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  }

  /**
   * Get file from local filesystem
   */
  private async getFromLocal(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.localStoragePath, filePath);
    return await fs.readFile(fullPath);
  }

  /**
   * Delete file from S3
   */
  private async deleteFromS3(filePath: string): Promise<void> {
    if (!this.s3Client || !this.s3Bucket) {
      throw new Error('S3 client not initialized');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.s3Bucket,
      Key: filePath
    });

    await this.s3Client.send(command);
  }

  /**
   * Delete file from local filesystem
   */
  private async deleteFromLocal(filePath: string): Promise<void> {
    const fullPath = path.join(this.localStoragePath, filePath);
    await fs.unlink(fullPath);
  }

  /**
   * Generate unique filename
   */
  private generateFilename(contentType: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = this.getExtensionFromContentType(contentType);
    return `${timestamp}_${random}.${ext}`;
  }

  /**
   * Get file extension from content type
   */
  private getExtensionFromContentType(contentType: string): string {
    const map: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'application/octet-stream': 'bin'
    };
    
    return map[contentType] || 'bin';
  }
}

// Export singleton instance
export default new FileStorageService();
