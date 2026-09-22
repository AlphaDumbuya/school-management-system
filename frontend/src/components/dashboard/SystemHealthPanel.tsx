import React from 'react';
import { Database, Clock, HardDrive, Users } from 'lucide-react';

export interface SystemHealthProps {
  databaseStatus: 'healthy' | 'warning' | 'error';
  lastBackup: string;
  apiResponseTime: number;
  storageUsage: number;
  activeUsers: number;
  /**
   * When true (platform super admin) the panel shows infrastructure metrics
   * (database, API latency, storage, backups). Tenants (principals) only see
   * their own school's activity, not platform internals.
   */
  isPlatformAdmin?: boolean;
}

const statusColors = {
  healthy: { bg: 'bg-green-100', text: 'text-green-800', indicator: 'bg-green-500' },
  warning: { bg: 'bg-amber-100', text: 'text-amber-800', indicator: 'bg-amber-500' },
  error: { bg: 'bg-red-100', text: 'text-red-800', indicator: 'bg-red-500' },
};

const StatusBadge: React.FC<{ status: 'healthy' | 'warning' | 'error'; label: string }> = ({
  status,
  label,
}) => {
  const colors = statusColors[status];
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
      <div className={`w-1.5 h-1.5 rounded-full ${colors.indicator}`} />
      <span className="text-xs font-semibold">{label}</span>
    </div>
  );
};

export const SystemHealthPanel: React.FC<SystemHealthProps> = ({
  databaseStatus,
  lastBackup,
  apiResponseTime,
  storageUsage,
  activeUsers,
  isPlatformAdmin = false,
}) => {
  const lastBackupDate = new Date(lastBackup);
  const formattedBackupTime = lastBackupDate.toLocaleString();
  const hoursAgo = Math.floor((Date.now() - lastBackupDate.getTime()) / (1000 * 60 * 60));

  // Tenants (principals) only see their own school's activity — infrastructure
  // metrics are platform-internal and reserved for the super admin.
  if (!isPlatformAdmin) {
    return (
      <div className="bg-white rounded-2xl ring-1 ring-gray-200/80 shadow-sm p-4 sm:p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">School Activity</h3>
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users size={22} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-0.5">Active Users</p>
            <p className="text-2xl font-extrabold text-gray-900">{activeUsers}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">Signed in during the last 24 hours</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl ring-1 ring-gray-200/80 shadow-sm p-4 sm:p-5">
      <h3 className="text-sm font-bold text-gray-900 mb-4">System Health</h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Database Status */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Database size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1.5">Database</p>
            <StatusBadge status={databaseStatus} label={databaseStatus.toUpperCase()} />
          </div>
        </div>

        {/* Last Backup */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
            <Clock size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1">Last Backup</p>
            <p className="text-sm font-bold text-gray-900">{hoursAgo}h ago</p>
            <p className="text-[10px] text-gray-400 truncate">{formattedBackupTime}</p>
          </div>
        </div>

        {/* API Response Time */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <Clock size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1">API Response</p>
            <p className="text-sm font-bold text-gray-900">{apiResponseTime}ms</p>
            <p className={`text-[10px] font-medium ${apiResponseTime < 200 ? 'text-green-600' : 'text-amber-600'}`}>
              {apiResponseTime < 200 ? 'Optimal' : 'Good'}
            </p>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <HardDrive size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1">Storage</p>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  storageUsage < 60 ? 'bg-green-500' : storageUsage < 80 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${storageUsage}%` }}
              />
            </div>
            <p className="text-sm font-bold text-gray-900">{storageUsage}% Used</p>
          </div>
        </div>

        {/* Active Users */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-1">Active Users</p>
            <p className="text-sm font-bold text-gray-900">{activeUsers}</p>
            <p className="text-[10px] text-gray-400">Last 24 hours</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthPanel;
