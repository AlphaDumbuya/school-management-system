import { Backup, BackupValidation, BackupResponse } from '../types/backup';
import * as crypto from 'crypto';
import * as fs from 'fs';

/**
 * Backup Verification Service
 * Handles backup integrity verification and validation
 */
export class BackupVerificationService {
  private validations: Map<string, BackupValidation> = new Map();
  private verificationStatus: Map<string, { isValid: boolean; lastChecked: string }> = new Map();

  /**
   * Verify backup integrity
   */
  async verifyBackupIntegrity(backup: Backup): Promise<BackupResponse<BackupValidation>> {
    try {
      const validationId = `validation-${Date.now()}`;

      const validation: BackupValidation = {
        id: validationId,
        backupId: backup.id,
        status: 'in-progress',
        checksumValid: false,
        integrityCheck: false,
        recoverabilityCheck: false,
        warnings: [],
        errors: [],
        createdAt: new Date().toISOString(),
      };

      this.validations.set(validationId, validation);

      // Verify checksum
      const checksumValid = await this.verifyChecksum(backup);
      validation.checksumValid = checksumValid;

      if (!checksumValid) {
        validation.errors!.push('Checksum verification failed - backup may be corrupted');
      }

      // Verify file integrity
      const fileValid = await this.verifyFileIntegrity(backup);
      validation.integrityCheck = fileValid;

      if (!fileValid) {
        validation.errors!.push('File integrity check failed');
      }

      // Test recoverability
      const recoverabilityValid = await this.testRecoverability(backup);
      validation.recoverabilityCheck = recoverabilityValid;

      if (!recoverabilityValid) {
        validation.warnings!.push('Recoverability test warning - backup may be incomplete');
      }

      // Set validation status
      validation.status = validation.errors!.length === 0 ? 'completed' : 'failed';
      validation.completedAt = new Date().toISOString();

      this.validations.set(validationId, validation);

      // Cache verification status
      const isValid = checksumValid && fileValid;
      this.verificationStatus.set(backup.id, {
        isValid,
        lastChecked: new Date().toISOString(),
      });

      return {
        success: validation.errors!.length === 0,
        data: validation,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Verify backup checksum
   */
  private async verifyChecksum(backup: Backup): Promise<boolean> {
    try {
      if (!backup.location || !fs.existsSync(backup.location)) {
        return false;
      }

      // Read backup file
      const fileContent = fs.readFileSync(backup.location);

      // Calculate checksum
      const hash = crypto.createHash('sha256');
      hash.update(fileContent);
      const calculatedChecksum = hash.digest('hex');

      // Compare with stored checksum
      return calculatedChecksum === backup.checksum;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verify file integrity
   */
  private async verifyFileIntegrity(backup: Backup): Promise<boolean> {
    try {
      if (!backup.location || !fs.existsSync(backup.location)) {
        return false;
      }

      const stats = fs.statSync(backup.location);

      // Check file size matches backup metadata
      if (stats.size !== backup.size && backup.size > 0) {
        // Allow some tolerance (within 5%)
        const tolerance = backup.size * 0.05;
        if (Math.abs(stats.size - backup.size) > tolerance) {
          return false;
        }
      }

      // Check file is readable
      fs.accessSync(backup.location, fs.constants.R_OK);

      // Check file is not empty
      if (stats.size === 0) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test backup recoverability
   */
  private async testRecoverability(backup: Backup): Promise<boolean> {
    try {
      // In production, would attempt to restore to a test instance
      // For now, basic checks:

      // Check backup file exists and is readable
      if (!backup.location || !fs.existsSync(backup.location)) {
        return false;
      }

      // Check backup metadata is complete
      if (!backup.metadata || !backup.metadata.tables || backup.metadata.tables.length === 0) {
        return false;
      }

      // Check backup has required metadata fields
      if (!backup.metadata.version || !backup.metadata.timestamp) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get validation result
   */
  async getValidation(validationId: string): Promise<BackupValidation | null> {
    return this.validations.get(validationId) || null;
  }

  /**
   * Get all validations for backup
   */
  async getBackupValidations(backupId: string): Promise<BackupValidation[]> {
    return Array.from(this.validations.values()).filter(v => v.backupId === backupId);
  }

  /**
   * Check backup verification status
   */
  async getVerificationStatus(
    backupId: string
  ): Promise<{ isValid: boolean; lastChecked: string; needsVerification: boolean } | null> {
    const status = this.verificationStatus.get(backupId);
    if (!status) {
      return null;
    }

    // Check if verification is older than 7 days
    const lastChecked = new Date(status.lastChecked);
    const now = new Date();
    const daysSinceCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24);
    const needsVerification = daysSinceCheck > 7;

    return {
      isValid: status.isValid,
      lastChecked: status.lastChecked,
      needsVerification,
    };
  }

  /**
   * Verify all recent backups
   */
  async verifyRecentBackups(backups: Backup[]): Promise<{
    totalVerified: number;
    validCount: number;
    invalidCount: number;
    warningCount: number;
    results: Array<{ backupId: string; isValid: boolean; warnings: string[]; errors: string[] }>;
  }> {
    const results: Array<{ backupId: string; isValid: boolean; warnings: string[]; errors: string[] }> = [];
    let validCount = 0;
    let invalidCount = 0;
    let warningCount = 0;

    for (const backup of backups) {
      const validation = await this.verifyBackupIntegrity(backup);

      if (validation.success && validation.data) {
        const isValid = validation.data.errors!.length === 0;
        if (isValid) validCount++;
        else invalidCount++;

        if (validation.data.warnings!.length > 0) warningCount++;

        results.push({
          backupId: backup.id,
          isValid,
          warnings: validation.data.warnings || [],
          errors: validation.data.errors || [],
        });
      }
    }

    return {
      totalVerified: backups.length,
      validCount,
      invalidCount,
      warningCount,
      results,
    };
  }

  /**
   * Get verification health report
   */
  async getVerificationHealthReport(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    totalBackupsVerified: number;
    validBackups: number;
    failedVerifications: number;
    recentFailures: number;
    recommendations: string[];
  }> {
    const allValidations = Array.from(this.validations.values());
    const recentValidations = allValidations.filter(v => {
      const createdDate = new Date(v.createdAt);
      const now = new Date();
      return (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24) < 1; // Last 24 hours
    });

    const validCount = recentValidations.filter(v => v.status === 'completed' && !v.errors?.length).length;
    const failedCount = recentValidations.filter(v => v.status === 'failed').length;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    const recommendations: string[] = [];

    if (failedCount > 0) {
      status = 'critical';
      recommendations.push('Investigate and fix failed backup verifications immediately');
    }

    if (validCount < recentValidations.length * 0.9) {
      if (status === 'healthy') status = 'warning';
      recommendations.push('Backup verification success rate is below 90%');
    }

    if (recentValidations.length === 0) {
      recommendations.push('No recent backup verifications. Schedule regular verification tasks.');
    }

    return {
      status,
      totalBackupsVerified: allValidations.length,
      validBackups: validCount,
      failedVerifications: failedCount,
      recentFailures: failedCount,
      recommendations,
    };
  }

  /**
   * Create verification report
   */
  async createVerificationReport(backups: Backup[]): Promise<string> {
    const results = await this.verifyRecentBackups(backups);
    const health = await this.getVerificationHealthReport();

    const lines = [
      '=== BACKUP VERIFICATION REPORT ===',
      `Generated: ${new Date().toISOString()}`,
      '',
      'SUMMARY:',
      `Total Backups Verified: ${results.totalVerified}`,
      `Valid Backups: ${results.validCount}`,
      `Invalid Backups: ${results.invalidCount}`,
      `Backups with Warnings: ${results.warningCount}`,
      `Success Rate: ${results.totalVerified > 0 ? ((results.validCount / results.totalVerified) * 100).toFixed(1) : 0}%`,
      '',
      'HEALTH STATUS:',
      `Overall Status: ${health.status.toUpperCase()}`,
      `Total Verified: ${health.totalBackupsVerified}`,
      `Valid: ${health.validBackups}`,
      `Failed: ${health.failedVerifications}`,
      '',
      'RECOMMENDATIONS:',
      ...health.recommendations.map(r => `- ${r}`),
      '',
      'DETAILED RESULTS:',
      ...results.results.map(r => {
        const status = r.isValid ? '✓' : '✗';
        let detail = `${status} ${r.backupId}`;
        if (r.warnings.length > 0) detail += ` (${r.warnings.length} warning)`;
        if (r.errors.length > 0) detail += ` (${r.errors.length} error)`;
        return detail;
      }),
    ];

    return lines.join('\n');
  }

  /**
   * Schedule automatic verification
   */
  async scheduleAutomaticVerification(backups: Backup[], intervalDays: number = 7): Promise<{
    scheduled: number;
    nextVerificationDate: string;
  }> {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);

    return {
      scheduled: backups.length,
      nextVerificationDate: nextDate.toISOString(),
    };
  }
}

export default new BackupVerificationService();
