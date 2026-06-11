import { Backup, BackupResponse, RecoveryPlan } from '../types/backup';
import BackupService from './backupService';
import BackupVerificationService from './backupVerificationService';
import RestoreService from './restoreService';

/**
 * Backup Management Service
 * High-level orchestration of backup operations and management
 */
export class BackupManagementService {
  private recoveryPlans: Map<string, RecoveryPlan> = new Map();

  /**
   * Create comprehensive backup management plan
   */
  async createRecoveryPlan(
    name: string,
    rto: number = 4, // 4 hours
    rpo: number = 1 // 1 hour
  ): Promise<BackupResponse<RecoveryPlan>> {
    try {
      const plan: RecoveryPlan = {
        id: `plan-${Date.now()}`,
        name,
        description: `Recovery plan with RTO: ${rto}h, RPO: ${rpo}h`,
        rto,
        rpo,
        backupStrategy: rpo <= 1 ? 'incremental' : 'hybrid',
        replicationEnabled: rto <= 1,
        geographicRedundancy: rto <= 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.recoveryPlans.set(plan.id, plan);

      return {
        success: true,
        data: plan,
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
   * Get all recovery plans
   */
  async getAllRecoveryPlans(): Promise<RecoveryPlan[]> {
    return Array.from(this.recoveryPlans.values());
  }

  /**
   * Get recovery plan
   */
  async getRecoveryPlan(planId: string): Promise<RecoveryPlan | null> {
    return this.recoveryPlans.get(planId) || null;
  }

  /**
   * Get full backup status
   */
  async getFullBackupStatus(): Promise<{
    backupStatus: {
      totalBackups: number;
      recentBackups: Backup[];
      oldestBackup?: Backup;
      newestBackup?: Backup;
    };
    storageStatus: {
      usedSpace: number;
      availableSpace: number;
      utilisationPercentage: number;
    };
    verificationStatus: {
      lastVerificationDate?: string;
      validBackups: number;
      failedVerifications: number;
    };
    restoreStatus: {
      successRate: number;
      recentRestores: number;
    };
  }> {
    const stats = await BackupService.getBackupStatistics();
    const storageHealth = await BackupService.checkStorageHealth();
    const verificationHealth = await BackupVerificationService.getVerificationHealthReport();
    const restoreStats = await RestoreService.getRestoreStatistics();

    const allBackups = await BackupService.getAllBackups();

    return {
      backupStatus: {
        totalBackups: stats.totalBackups,
        recentBackups: allBackups.slice(0, 5),
        oldestBackup: stats.oldestBackup ? await BackupService.getBackup(stats.oldestBackup.id) : undefined,
        newestBackup: stats.newestBackup ? await BackupService.getBackup(stats.newestBackup.id) : undefined,
      },
      storageStatus: {
        usedSpace: storageHealth.usedSpace,
        availableSpace: storageHealth.availableSpace,
        utilisationPercentage: storageHealth.utilisationPercentage,
      },
      verificationStatus: {
        lastVerificationDate: allBackups.length > 0 ? allBackups[0].createdAt : undefined,
        validBackups: verificationHealth.validBackups,
        failedVerifications: verificationHealth.failedVerifications,
      },
      restoreStatus: {
        successRate: restoreStats.successRate,
        recentRestores: 5, // Show last 5 restores
      },
    };
  }

  /**
   * Generate comprehensive backup management report
   */
  async generateManagementReport(): Promise<string> {
    const status = await this.getFullBackupStatus();
    const stats = await BackupService.getBackupStatistics();
    const restoreStats = await RestoreService.getRestoreStatistics();
    const plans = await this.getAllRecoveryPlans();

    const lines = [
      '================================================================================',
      '                      BACKUP MANAGEMENT REPORT',
      '================================================================================',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '--- BACKUP STATUS ---',
      `Total Backups: ${status.backupStatus.totalBackups}`,
      `Backup Types:`,
      `  - Full: ${stats.backupsByType.full}`,
      `  - Incremental: ${stats.backupsByType.incremental}`,
      `  - Differential: ${stats.backupsByType.differential}`,
      `Success Rate: ${stats.successRate}%`,
      `Average Backup Time: ${stats.averageBackupTime}ms`,
      '',
      '--- STORAGE STATUS ---',
      `Used Space: ${(status.storageStatus.usedSpace / 1024 / 1024 / 1024).toFixed(2)}GB`,
      `Available Space: ${(status.storageStatus.availableSpace / 1024 / 1024 / 1024).toFixed(2)}GB`,
      `Storage Utilisation: ${status.storageStatus.utilisationPercentage}%`,
      '',
      '--- VERIFICATION STATUS ---',
      `Valid Backups: ${status.verificationStatus.validBackups}`,
      `Failed Verifications: ${status.verificationStatus.failedVerifications}`,
      `Last Verification: ${status.verificationStatus.lastVerificationDate || 'Never'}`,
      '',
      '--- RESTORE STATUS ---',
      `Total Restores: ${restoreStats.totalRestores}`,
      `Successful Restores: ${restoreStats.successfulRestores}`,
      `Failed Restores: ${restoreStats.failedRestores}`,
      `Success Rate: ${restoreStats.successRate}%`,
      `Average Restore Time: ${(restoreStats.averageRestoreTime / 1000).toFixed(1)}s`,
      '',
      '--- RECOVERY PLANS ---',
      `Total Plans: ${plans.length}`,
      ...plans.map(p => `  - ${p.name}: RTO=${p.rto}h, RPO=${p.rpo}h`),
      '',
      '--- RECOMMENDATIONS ---',
      this.generateRecommendations(status),
      '',
      '================================================================================',
    ];

    return lines.join('\n');
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(status: any): string {
    const recommendations: string[] = [];

    if (status.backupStatus.totalBackups < 3) {
      recommendations.push('⚠ Consider scheduling more frequent backups');
    }

    if (status.storageStatus.utilisationPercentage > 80) {
      recommendations.push('⚠ Storage utilisation is high - consider archiving old backups');
    }

    if (status.verificationStatus.failedVerifications > 0) {
      recommendations.push('⚠ Failed verifications detected - investigate and rerun');
    }

    if (status.restoreStatus.successRate < 95) {
      recommendations.push('⚠ Restore success rate is below 95% - review restore logs');
    }

    if (recommendations.length === 0) {
      recommendations.push('✓ All backup systems operating normally');
    }

    return recommendations.join('\n');
  }

  /**
   * Perform backup maintenance
   */
  async performBackupMaintenance(): Promise<BackupResponse<{
    cleanedBackups: number;
    freedSpace: number;
    verifiedBackups: number;
  }>> {
    try {
      // Clean up old backups
      const cleanupResult = await BackupService.cleanupOldBackups(90);
      if (!cleanupResult.success) {
        return cleanupResult;
      }

      const cleanupData = cleanupResult.data!;

      // Verify recent backups
      const allBackups = await BackupService.getRecentBackups(5);
      const verificationResult = await BackupVerificationService.verifyRecentBackups(allBackups);

      return {
        success: true,
        data: {
          cleanedBackups: cleanupData.deletedCount,
          freedSpace: cleanupData.freedSpace,
          verifiedBackups: verificationResult.totalVerified,
        },
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
   * Test disaster recovery
   */
  async testDisasterRecovery(planId: string): Promise<BackupResponse<{
    testStatus: string;
    duration: number;
    issues: string[];
  }>> {
    try {
      const plan = await this.getRecoveryPlan(planId);
      if (!plan) {
        return {
          success: false,
          error: 'Recovery plan not found',
          timestamp: new Date().toISOString(),
        };
      }

      const startTime = Date.now();
      const issues: string[] = [];

      // Get recent backups for testing
      const backups = await BackupService.getRecentBackups(1);
      if (backups.length === 0) {
        issues.push('No recent backups available for testing');
      } else {
        // Test restore on test instance
        const testResult = await RestoreService.testRestoreOnTestInstance(backups[0]);
        if (!testResult.success && testResult.data?.issues) {
          issues.push(...testResult.data.issues);
        }
      }

      const duration = Date.now() - startTime;

      // Update plan last test date
      plan.lastTestDate = new Date().toISOString();

      const testStatus = issues.length === 0 ? 'PASSED' : 'FAILED';

      return {
        success: issues.length === 0,
        data: { testStatus, duration, issues },
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
   * Get backup health dashboard
   */
  async getBackupHealthDashboard(): Promise<{
    overallStatus: 'healthy' | 'warning' | 'critical';
    components: Array<{
      name: string;
      status: 'healthy' | 'warning' | 'critical';
      message: string;
    }>;
  }> {
    const status = await this.getFullBackupStatus();
    const storageHealth = await BackupService.checkStorageHealth();
    const verificationHealth = await BackupVerificationService.getVerificationHealthReport();

    const components = [
      {
        name: 'Backup Storage',
        status: storageHealth.status,
        message: `${storageHealth.utilisationPercentage}% utilisation`,
      },
      {
        name: 'Backup Verification',
        status: verificationHealth.status,
        message: `${verificationHealth.validBackups} valid, ${verificationHealth.failedVerifications} failed`,
      },
      {
        name: 'Restore Operations',
        status: status.restoreStatus.successRate >= 95 ? 'healthy' : 'warning',
        message: `${status.restoreStatus.successRate}% success rate`,
      },
    ];

    const criticalCount = components.filter(c => c.status === 'critical').length;
    const warningCount = components.filter(c => c.status === 'warning').length;

    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (criticalCount > 0) overallStatus = 'critical';
    else if (warningCount > 0) overallStatus = 'warning';

    return {
      overallStatus,
      components,
    };
  }
}

export default new BackupManagementService();
