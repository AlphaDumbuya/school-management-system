/**
 * Backup and Disaster Recovery types
 */

export interface BackupJob {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'differential';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  scheduleId?: string;
  triggeredBy: 'manual' | 'scheduled' | 'event';
}

export interface Backup {
  id: string;
  jobId: string;
  name: string;
  type: 'full' | 'incremental' | 'differential';
  size: number; // in bytes
  location: string; // file path or S3 location
  checksum: string; // for integrity verification
  createdAt: string;
  expiresAt: string;
  metadata: BackupMetadata;
  isEncrypted: boolean;
  isCompressed: boolean;
  backupData?: {
    tables: string[];
    recordCount: number;
    backupDuration: number; // in milliseconds
  };
}

export interface BackupMetadata {
  version: string; // Database version
  timestamp: string;
  description?: string;
  serverName?: string;
  backupSize?: number;
  tables?: Array<{
    name: string;
    recordCount: number;
  }>;
  tags?: string[];
}

export interface BackupSchedule {
  id: string;
  name: string;
  type: 'full' | 'incremental' | 'differential';
  frequency: 'daily' | 'weekly' | 'monthly' | 'hourly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:mm format
  timezone?: string;
  enabled: boolean;
  retentionDays: number;
  maxRetentionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RestoreJob {
  id: string;
  backupId: string;
  backupName: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  restoreTarget: 'current' | 'new' | 'point-in-time';
  restoreTime?: string; // For point-in-time recovery
  progress: number; // 0-100%
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  estimatedTimeRemaining?: number; // in seconds
}

export interface BackupValidation {
  id: string;
  backupId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  checksumValid: boolean;
  integrityCheck: boolean;
  recoverabilityCheck: boolean;
  warnings?: string[];
  errors?: string[];
  createdAt: string;
  completedAt?: string;
}

export interface BackupStatistics {
  totalBackups: number;
  totalSize: number;
  oldestBackup?: {
    id: string;
    createdAt: string;
  };
  newestBackup?: {
    id: string;
    createdAt: string;
  };
  backupsByType: {
    full: number;
    incremental: number;
    differential: number;
  };
  successRate: number; // percentage
  averageBackupTime: number; // milliseconds
  storageUsed: number;
  storageQuota?: number;
}

export interface RecoveryPlan {
  id: string;
  name: string;
  description?: string;
  rto: number; // Recovery Time Objective in minutes
  rpo: number; // Recovery Point Objective in minutes
  backupStrategy: 'full-only' | 'incremental' | 'hybrid';
  replicationEnabled: boolean;
  geographicRedundancy: boolean;
  testSchedule?: string;
  lastTestDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface BackupNotification {
  id: string;
  type: 'backup-completed' | 'backup-failed' | 'restore-completed' | 'restore-failed' | 'validation-warning' | 'storage-warning';
  message: string;
  relatedBackupId?: string;
  severity: 'info' | 'warning' | 'error';
  createdAt: string;
  read: boolean;
}

export interface PointInTimeRestore {
  backupId: string;
  targetTime: string;
  includeTransactions?: boolean;
  beforeTime?: string;
  afterTime?: string;
}

export interface BackupLocation {
  type: 'local' | 's3' | 'azure' | 'gcs' | 'network-share';
  path: string;
  credentials?: {
    accessKey?: string;
    secretKey?: string;
    connectionString?: string;
    username?: string;
    password?: string;
  };
  encryption?: {
    algorithm: 'AES-256' | 'AES-128';
    key?: string;
  };
}
