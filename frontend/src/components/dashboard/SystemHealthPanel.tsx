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
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${colors.bg} ${colors.text}`}>
      <div className={`w-2 h-2 rounded-full ${colors.indicator}`}></div>
      <span className="text-sm font-medium">{label}</span>
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-6 text-gray-800">School Activity</h3>
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Users size={22} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-1">Active Users</p>
            <p className="text-2xl font-extrabold text-gray-900">{activeUsers}</p>
            <p className="text-xs text-gray-500 mt-0.5">Signed in during the last 24 hours</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-6 text-gray-800">System Health</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Database Status */}
        <div className="flex items-start gap-4">
          <div className="text-2xl text-blue-500">
            <Database size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-2">Database</p>
            <StatusBadge status={databaseStatus} label={databaseStatus.toUpperCase()} />
          </div>
        </div>

        {/* Last Backup */}
        <div className="flex items-start gap-4">
          <div className="text-2xl text-green-500">
            <Clock size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-2">Last Backup</p>
            <p className="font-semibold text-sm">{hoursAgo}h ago</p>
            <p className="text-xs text-gray-500">{formattedBackupTime}</p>
          </div>
        </div>

        {/* API Response Time */}
        <div className="flex items-start gap-4">
          <div className="text-2xl text-purple-500">
            <Clock size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-2">API Response Time</p>
            <p className="font-semibold text-sm">{apiResponseTime}ms</p>
            <p className={`text-xs ${apiResponseTime < 200 ? 'text-green-600' : 'text-amber-600'}`}>
              {apiResponseTime < 200 ? 'Optimal' : 'Good'}
            </p>
          </div>
        </div>

        {/* Storage Usage */}
        <div className="flex items-start gap-4">
          <div className="text-2xl text-amber-500">
            <HardDrive size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-2">Storage Usage</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  storageUsage < 60 ? 'bg-green-500' : storageUsage < 80 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${storageUsage}%` }}
              ></div>
            </div>
            <p className="font-semibold text-sm">{storageUsage}% Used</p>
          </div>
        </div>

        {/* Active Users */}
        <div className="flex items-start gap-4">
          <div className="text-2xl text-blue-500">
            <Users size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-2">Active Users</p>
            <p className="font-semibold text-sm">{activeUsers}</p>
            <p className="text-xs text-gray-500">Last 24 hours</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthPanel;
