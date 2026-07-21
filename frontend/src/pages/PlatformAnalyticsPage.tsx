import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Building2,
  Users,
  HardDrive,
  DollarSign,
  PieChart,
  BarChart3,
  Activity,
  Server,
  Database,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { showToast } from '@utils/toast';
import platformService, { PlatformStatistics } from '../services/platformService';

export const PlatformAnalyticsPage: React.FC = () => {
  const [statistics, setStatistics] = useState<PlatformStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await platformService.getStatistics();
        if (res.success && res.data) {
          setStatistics(res.data);
        }
      } catch (err) {
        console.error('Error loading platform statistics:', err);
        showToast.error('Failed to load platform analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <MainLayout>
      <PageShell
        title="Platform Analytics"
        subtitle="Auditing signups, billing history, subscription distributions, and database health metrics."
        breadcrumbs={[{ label: 'Platform Dashboard', path: '/platform/dashboard' }, { label: 'Platform Analytics' }]}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-blue-500" size={32} />
              <span className="text-sm text-gray-500">Loading analytics dashboards...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI ROW */}
            {statistics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <KPICard
                  title="Monthly Recurring Revenue"
                  value="Le 25,000"
                  subtitle="Annual ARR: Le 285,000"
                  icon={<div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500"><DollarSign size={20} /></div>}
                />
                <KPICard
                  title="Active Schools"
                  value={statistics.activeTenants}
                  subtitle={`${statistics.trialTenants} trial spaces active`}
                  icon={<div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500"><Building2 size={20} /></div>}
                />
                <KPICard
                  title="Active Students"
                  value={statistics.totalStudents.toLocaleString()}
                  subtitle="Primary & Secondary levels"
                  icon={<div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500"><Users size={20} /></div>}
                />
                <KPICard
                  title="Storage Consumption"
                  value="7.2 GB"
                  subtitle="Usage from 100 GB cap"
                  icon={<div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500"><HardDrive size={20} /></div>}
                />
              </div>
            )}

            {/* ANALYTICS CHARTS MATRIX */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Plan Distribution */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <PieChart size={16} className="text-purple-500" /> Subscription Tier Distribution
                  </h3>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Real-Time</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                      <span>Combra (Standard)</span>
                      <span>58%</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-900 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: '58%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                      <span>Freetong (Basic Trial)</span>
                      <span>32%</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-900 h-2 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: '32%' }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                      <span>Bintumani (Enterprise)</span>
                      <span>10%</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-900 h-2 rounded-full overflow-hidden">
                      <div className="bg-purple-600 h-full rounded-full" style={{ width: '10%' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Server & Database Health */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <Server size={16} className="text-blue-500" /> Platform Infrastructure Health
                  </h3>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Active</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-3.5 bg-gray-50 dark:bg-gray-900/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity size={14} className="text-emerald-500" />
                      <span className="text-[10px] text-gray-400 uppercase font-bold">API Gateway Response</span>
                    </div>
                    <span className="text-lg font-black text-gray-800 dark:text-gray-100">45ms</span>
                  </div>

                  <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-3.5 bg-gray-50 dark:bg-gray-900/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Database size={14} className="text-blue-500" />
                      <span className="text-[10px] text-gray-400 uppercase font-bold">Postgres Pool Utilization</span>
                    </div>
                    <span className="text-lg font-black text-gray-800 dark:text-gray-100">12% / 100 max</span>
                  </div>

                  <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-3.5 bg-gray-50 dark:bg-gray-900/30">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp size={14} className="text-purple-500" />
                      <span className="text-[10px] text-gray-400 uppercase font-bold">Cache Hit Ratio</span>
                    </div>
                    <span className="text-lg font-black text-gray-800 dark:text-gray-100">94.8%</span>
                  </div>

                  <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-3.5 bg-gray-50 dark:bg-gray-900/30">
                    <div className="flex items-center gap-2 mb-1">
                      <Server size={14} className="text-amber-500" />
                      <span className="text-[10px] text-gray-400 uppercase font-bold">CPU Usage</span>
                    </div>
                    <span className="text-lg font-black text-gray-800 dark:text-gray-100">8.4%</span>
                  </div>
                </div>
              </div>

              {/* Recent Signups Activity */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm lg:col-span-2">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <BarChart3 size={16} className="text-emerald-500" /> Recent Signups & Registration Log
                  </h3>
                  <span className="text-xs text-blue-600 font-semibold flex items-center gap-0.5 cursor-pointer hover:underline">
                    View Log <ArrowUpRight size={14} />
                  </span>
                </div>
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="font-bold text-gray-800 dark:text-gray-200">Annie Walsh Memorial School</span>
                    </div>
                    <span className="text-gray-400">Registered trial plan · 3 days ago</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="font-bold text-gray-800 dark:text-gray-200">Model Primary School Bo</span>
                    </div>
                    <span className="text-gray-400">Registered basic plan · 1 week ago</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span className="font-bold text-gray-800 dark:text-gray-200">St. Edward's Secondary School</span>
                    </div>
                    <span className="text-gray-400">Registered enterprise plan · 2 weeks ago</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default PlatformAnalyticsPage;
