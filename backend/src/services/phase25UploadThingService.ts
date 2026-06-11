import { logger } from '@utils/logger';
import axios, { AxiosInstance } from 'axios';

/**
 * Interface for file upload configuration
 */
export interface FileUploadConfig {
  file: Buffer;
  filename: string;
  mimeType: string;
  entityType: 'student' | 'teacher' | 'admission' | 'school';
  entityId: string;
  fileCategory: 'document' | 'photo' | 'certificate' | 'qualification' | 'resource';
  metadata?: Record<string, any>;
}

/**
 * Interface for file upload response
 */
export interface FileUploadResponse {
  fileId: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  status: 'success' | 'failed';
  error?: string;
}

/**
 * Interface for file metadata
 */
export interface FileMetadata {
  id: string;
  fileId: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  entityType: string;
  entityId: string;
  fileCategory: string;
  uploadedAt: Date;
  uploadedBy: string;
  accessControl: 'public' | 'private' | 'restricted';
  metadata?: Record<string, any>;
}

/**
 * Interface for file download
 */
export interface FileDownload {
  fileId: string;
  content: Buffer;
  filename: string;
  mimeType: string;
}

/**
 * UploadThing File Upload Service
 * 
 * Handles file uploads and downloads through UploadThing service.
 * Supports multiple file types with validation, access control,
 * and comprehensive audit logging.
 * 
 * @class UploadThingService
 * @example
 * const service = new UploadThingService();
 * const result = await service.uploadFile({
 *   file: fileBuffer,
 *   filename: 'document.pdf',
 *   mimeType: 'application/pdf',
 *   entityType: 'student',
 *   entityId: 'student123',
 *   fileCategory: 'document'
 * });
 */
export class UploadThingService {
  private client: AxiosInstance;
  private apiKey: string;
  private appId: string;
  private secret: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second
  private rateLimitDelay: number = 100; // 100ms between requests

  // File type restrictions (in bytes)
  private readonly MAX_FILE_SIZES = {
    image: 5 * 1024 * 1024, // 5MB
    document: 10 * 1024 * 1024, // 10MB
    certificate: 5 * 1024 * 1024, // 5MB
    photo: 5 * 1024 * 1024, // 5MB
    resource: 20 * 1024 * 1024, // 20MB
  };

  // Allowed MIME types
  private readonly ALLOWED_MIME_TYPES: Record<string, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    certificate: ['application/pdf'],
    photo: ['image/jpeg', 'image/png', 'image/webp'],
    resource: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'],
  };

  /**
   * Initialize UploadThing File Upload Service
   */
  constructor() {
    this.apiKey = process.env.UPLOADTHING_API_KEY || '';
    this.appId = process.env.UPLOADTHING_APP_ID || '';
    this.secret = process.env.UPLOADTHING_SECRET || '';

    if (!this.apiKey || !this.appId || !this.secret) {
      logger.error('UploadThing credentials are not fully configured in environment variables');
      throw new Error('UPLOADTHING_API_KEY, UPLOADTHING_APP_ID, and UPLOADTHING_SECRET are required');
    }

    this.client = axios.create({
      baseURL: 'https://api.uploadthing.com/v1',
      headers: {
        'X-Uploadthing-Api-Key': this.apiKey,
        'X-Uploadthing-Be-Api-Key': this.secret,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 60000,
    });

    logger.info('UploadThingService initialized successfully');
  }

  /**
   * Upload a file to UploadThing
   * 
   * @param config - File upload configuration
   * @returns File upload response with URL and metadata
   */
  async uploadFile(config: FileUploadConfig): Promise<FileUploadResponse> {
    try {
      this.validateFileUpload(config);

      const formData = new FormData();
      const blob = new Blob([config.file as BlobPart], { type: config.mimeType });
      formData.append('file', blob, config.filename);
      formData.append('entityType', config.entityType);
      formData.append('entityId', config.entityId);
      formData.append('fileCategory', config.fileCategory);

      if (config.metadata) {
        formData.append('metadata', JSON.stringify(config.metadata));
      }

      const response = await this.executeWithRetry(() =>
        this.client.post('/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })
      );

      logger.info(`File uploaded successfully`, {
        fileId: response.data.fileId,
        filename: config.filename,
        entityType: config.entityType,
        entityId: config.entityId,
        size: config.file.length,
      });

      return {
        fileId: response.data.fileId,
        filename: config.filename,
        url: response.data.url,
        size: config.file.length,
        mimeType: config.mimeType,
        uploadedAt: new Date(),
        status: 'success',
      };
    } catch (error) {
      logger.error('Failed to upload file', {
        filename: config.filename,
        entityType: config.entityType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        fileId: '',
        filename: config.filename,
        url: '',
        size: 0,
        mimeType: config.mimeType,
        uploadedAt: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Download a file from UploadThing
   * 
   * @param fileId - File ID to download
   * @returns File content and metadata
   */
  async downloadFile(fileId: string): Promise<FileDownload> {
    try {
      if (!fileId || fileId.trim().length === 0) {
        throw new Error('Valid file ID is required');
      }

      const response = await this.executeWithRetry(() =>
        this.client.get(`/files/${fileId}`, {
          responseType: 'arraybuffer',
        })
      );

      logger.info(`File downloaded successfully`, {
        fileId,
      });

      return {
        fileId,
        content: Buffer.from(response.data),
        filename: (response.headers['x-filename'] as string) || 'download',
        mimeType: (response.headers['content-type'] as string) || 'application/octet-stream',
      };
    } catch (error) {
      logger.error('Failed to download file', {
        fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete a file from UploadThing
   * 
   * @param fileId - File ID to delete
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      if (!fileId || fileId.trim().length === 0) {
        throw new Error('Valid file ID is required');
      }

      await this.executeWithRetry(() =>
        this.client.delete(`/files/${fileId}`)
      );

      logger.info(`File deleted successfully`, {
        fileId,
      });
    } catch (error) {
      logger.error('Failed to delete file', {
        fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get file metadata
   * 
   * @param fileId - File ID to retrieve metadata for
   * @returns File metadata
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata> {
    try {
      if (!fileId || fileId.trim().length === 0) {
        throw new Error('Valid file ID is required');
      }

      const response = await this.executeWithRetry(() =>
        this.client.get(`/files/${fileId}/metadata`)
      );

      logger.info(`Retrieved file metadata`, {
        fileId,
      });

      return {
        id: response.data.id,
        fileId: response.data.fileId,
        filename: response.data.filename,
        url: response.data.url,
        size: response.data.size,
        mimeType: response.data.mimeType,
        entityType: response.data.entityType,
        entityId: response.data.entityId,
        fileCategory: response.data.fileCategory,
        uploadedAt: new Date(response.data.uploadedAt),
        uploadedBy: response.data.uploadedBy,
        accessControl: response.data.accessControl || 'private',
        metadata: response.data.metadata,
      };
    } catch (error) {
      logger.error('Failed to retrieve file metadata', {
        fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * List files for an entity
   * 
   * @param entityType - Entity type (student, teacher, etc.)
   * @param entityId - Entity ID
   * @param fileCategory - Optional file category filter
   * @returns Array of file metadata
   */
  async listFiles(
    entityType: string,
    entityId: string,
    fileCategory?: string
  ): Promise<FileMetadata[]> {
    try {
      const params: Record<string, string> = {
        entityType,
        entityId,
      };

      if (fileCategory) {
        params.fileCategory = fileCategory;
      }

      const response = await this.executeWithRetry(() =>
        this.client.get('/files', { params })
      );

      logger.info(`Retrieved file list`, {
        entityType,
        entityId,
        fileCategory,
        count: response.data.files?.length || 0,
      });

      return (response.data.files || []).map((file: any) => ({
        id: file.id,
        fileId: file.fileId,
        filename: file.filename,
        url: file.url,
        size: file.size,
        mimeType: file.mimeType,
        entityType: file.entityType,
        entityId: file.entityId,
        fileCategory: file.fileCategory,
        uploadedAt: new Date(file.uploadedAt),
        uploadedBy: file.uploadedBy,
        accessControl: file.accessControl || 'private',
        metadata: file.metadata,
      }));
    } catch (error) {
      logger.error('Failed to list files', {
        entityType,
        entityId,
        fileCategory,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update file access control
   * 
   * @param fileId - File ID
   * @param accessControl - Access control level (public, private, restricted)
   */
  async updateFileAccess(fileId: string, accessControl: 'public' | 'private' | 'restricted'): Promise<void> {
    try {
      if (!fileId || fileId.trim().length === 0) {
        throw new Error('Valid file ID is required');
      }

      await this.executeWithRetry(() =>
        this.client.patch(`/files/${fileId}/access`, {
          accessControl,
        })
      );

      logger.info(`File access updated`, {
        fileId,
        accessControl,
      });
    } catch (error) {
      logger.error('Failed to update file access', {
        fileId,
        accessControl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get storage usage statistics
   * 
   * @returns Storage usage information
   */
  async getStorageUsage(): Promise<Record<string, any>> {
    try {
      const response = await this.executeWithRetry(() =>
        this.client.get('/storage/usage')
      );

      logger.info('Retrieved storage usage', {
        usage: response.data,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to retrieve storage usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate a download URL for a file (with optional expiration)
   * 
   * @param fileId - File ID
   * @param expirationMinutes - Optional expiration time in minutes
   * @returns Download URL
   */
  async generateDownloadUrl(fileId: string, expirationMinutes?: number): Promise<string> {
    try {
      if (!fileId || fileId.trim().length === 0) {
        throw new Error('Valid file ID is required');
      }

      const response = await this.executeWithRetry(() =>
        this.client.post(`/files/${fileId}/download-url`, {
          expirationMinutes: expirationMinutes || 60,
        })
      );

      logger.info(`Generated download URL`, {
        fileId,
        expirationMinutes: expirationMinutes || 60,
      });

      return response.data.downloadUrl;
    } catch (error) {
      logger.error('Failed to generate download URL', {
        fileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Validate file upload configuration
   * 
   * @param config - File upload configuration
   */
  private validateFileUpload(config: FileUploadConfig): void {
    // Validate filename
    if (!config.filename || config.filename.trim().length === 0) {
      throw new Error('Filename is required');
    }

    // Validate file size
    const maxSize = this.MAX_FILE_SIZES[config.fileCategory] || 5 * 1024 * 1024;
    if (config.file.length > maxSize) {
      throw new Error(`File size exceeds limit of ${maxSize / 1024 / 1024}MB`);
    }

    // Validate MIME type
    const allowedTypes = this.ALLOWED_MIME_TYPES[config.fileCategory] || [];
    if (allowedTypes.length > 0 && !allowedTypes.includes(config.mimeType)) {
      throw new Error(`MIME type ${config.mimeType} is not allowed for category ${config.fileCategory}`);
    }

    // Validate entity information
    if (!config.entityType || !config.entityId) {
      throw new Error('Entity type and ID are required');
    }

    // Validate entity type
    const validEntityTypes = ['student', 'teacher', 'admission', 'school'];
    if (!validEntityTypes.includes(config.entityType)) {
      throw new Error(`Invalid entity type: ${config.entityType}`);
    }
  }

  /**
   * Execute API call with retry logic
   * 
   * @param fn - Function to execute
   * @returns Response data
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Add rate limiting delay between requests
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }

        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));

        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          throw error;
        }

        logger.warn(`API call failed, retrying (attempt ${attempt + 1}/${this.maxRetries})`, {
          error: lastError.message,
        });
      }
    }

    throw lastError || new Error('API call failed after retries');
  }

  /**
   * Check if error is retryable
   * 
   * @param error - Error to check
   * @returns True if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    // Retry on network errors and 5xx server errors
    const message = error.message.toLowerCase();
    return (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('timeout') ||
      message.includes('5')
    );
  }

  /**
   * Get file organization path based on entity type
   * 
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param fileCategory - File category
   * @returns Organized file path
   */
  getFilePath(entityType: string, entityId: string, fileCategory: string): string {
    return `/${entityType}s/${entityId}/${fileCategory}s`;
  }
}

// Export singleton instance
export default new UploadThingService();
