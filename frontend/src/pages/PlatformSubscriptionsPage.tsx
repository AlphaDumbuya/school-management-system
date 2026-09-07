import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Building2,
  Users,
  HardDrive,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Search,
  CheckCircle2,
  Loader2,
  Shield,
  Clock,
  DollarSign,
  X,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { Button } from '@components/ui/button';
import { Modal } from '@components/admin/feedback/Modal';
import { showToast } from '@utils/toast';
import platformService, { PlatformTenant } from '../services/platformService';

export const PlatformSubscriptionsPage: React.FC = () => {
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  // Modify subscription modal
  const [selectedTenant, setSelectedTenant] = useState<PlatformTenant | null>(null);
  const [isModifyOpen, setIsModifyOpen] = useState(false);
  const [modifyForm, setModifyForm] = useState({
    plan_type: 'freetong',
    billing_cycle: 'monthly',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await platformService.getTenants({
        search: search || undefined,
      });
      if (res.success && res.data) {
        setTenants(res.data);
      }
    } catch (err) {
      console.error('Error fetching tenant subscriptions:', err);
      showToast.error('Failed to load subscriptions data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search]);

  const handleModifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;

    setSaving(true);
    try {
      const res = await platformService.changeTenantSubscription(
        selectedTenant.id,
        modifyForm.plan_type,
        modifyForm.billing_cycle
      );

      if (res.success) {
        showToast.success(`Tenant "${selectedTenant.name}" upgraded to ${modifyForm.plan_type.toUpperCase()} plan.`);
        setIsModifyOpen(false);
        setSelectedTenant(null);
        fetchData();
      }
    } catch (err: any) {
      showToast.error(err.response?.data?.error || 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  const getPlanLabel = (plan: string) => {
    const map: Record<string, string> = {
      freetong: 'Freetong (Basic Trial)',
      combra: 'Combra (Standard)',
      bintumani: 'Bintumani (Enterprise)',
    };
    return map[plan.toLowerCase()] || plan;
  };

  const getPlanPrice = (plan: string) => {
    const map: Record<string, string> = {
      freetong: 'Le 400/mo',
      combra: 'Le 900/mo',
      bintumani: 'Le 1,750/mo',
    };
    return map[plan.toLowerCase()] || 'Custom';
  };

  const getPlanBadgeVariant = (plan: string): 'active' | 'suspended' | 'trial' | 'expired' => {
    const map: Record<string, 'active' | 'suspended' | 'trial' | 'expired'> = {
      freetong: 'trial',
      combra: 'active',
      bintumani: 'active',
    };
    return map[plan.toLowerCase()] || 'expired';
  };

  // Filtered list client-side if planFilter is active
  const filteredTenants = tenants.filter((t) => {
    if (!planFilter) return true;
    return (t.plan || 'freetong').toLowerCase() === planFilter.toLowerCase();
  });

  return (
    <MainLayout>
      <PageShell
        title="SaaS Subscriptions"
        subtitle="Manage school plans, adjust user/storage limits, and configure free trial durations."
        breadcrumbs={[{ label: 'Platform Dashboard', path: '/platform/dashboard' }, { label: 'Subscriptions' }]}
      >
        {/* Plan Cards Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-[-10%] top-[-10%] opacity-10"><CreditCard size={150} /></div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">Basic Plan</span>
              <Sparkles size={18} />
            </div>
            <h3 className="text-xl font-bold mb-1">Freetong Trial</h3>
            <p className="text-2xl font-black mb-4">Le 400 <span className="text-xs font-normal">/ month</span></p>
            <ul className="text-xs space-y-2 border-t border-white/10 pt-4 opacity-90">
              <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Basic attendance & profiles</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Class/Subject & schedule manager</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Fee collection & SMS reminders</li>
              <li className="flex items-center gap-1.5 text-white/50"><X size={12} /> ID Card templates, WhatsApp, Analytics</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-[-10%] top-[-10%] opacity-10"><CreditCard size={150} /></div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">Growth Plan</span>
              <Sparkles size={18} />
            </div>
            <h3 className="text-xl font-bold mb-1">Combra Standard</h3>
            <p className="text-2xl font-black mb-4">Le 900 <span className="text-xs font-normal">/ month</span></p>
            <ul className="text-xs space-y-2 border-t border-white/10 pt-4 opacity-90">
              <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Everything in Freetong plan</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> ID cards designer & events tracking</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Discipline records & analytics</li>
              <li className="flex items-center gap-1.5 text-white/50"><X size={12} /> Advanced payroll, custom branding</li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
            <div className="absolute right-[-10%] top-[-10%] opacity-10"><CreditCard size={150} /></div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded">Unlimited Plan</span>
              <Sparkles size={18} />
            </div>
            <h3 className="text-xl font-bold mb-1">Bintumani Enterprise</h3>
            <p className="text-2xl font-black mb-4">Le 1,750 <span className="text-xs font-normal">/ month</span></p>
            <ul className="text-xs space-y-2 border-t border-white/10 pt-4 opacity-90">
              <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> All features unlocked</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Payroll modules & scholarships admin</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Custom school branding & logo configs</li>
              <li className="flex items-center gap-1.5"><CheckCircle2 size={12} /> Multi-branch school administration</li>
            </ul>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search school subscriptions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-100"
            />
          </div>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Tiers</option>
            <option value="freetong">Freetong</option>
            <option value="combra">Combra</option>
            <option value="bintumani">Bintumani</option>
          </select>
        </div>

        {/* Subscription Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-blue-500" size={32} />
              <span className="text-sm text-gray-500">Loading subscriptions list...</span>
            </div>
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
            <CreditCard size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">No subscriptions matching filters</h3>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">School / Tenant</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Subscription Level</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Billing Price</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">User Limits</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Subscription Status</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Building2 size={16} className="text-gray-400" />
                          <div>
                            <span className="font-bold text-gray-900 dark:text-gray-100 block text-sm">{tenant.name}</span>
                            <span className="text-xs text-gray-400 block font-mono">{tenant.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 block">
                          {getPlanLabel(tenant.plan || 'freetong')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-700 dark:text-gray-300">
                        {getPlanPrice(tenant.plan || 'freetong')}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-700 dark:text-gray-300 block">
                          <Users size={12} className="inline mr-1" /> {tenant.max_users || 500} Users
                        </span>
                        <span className="text-xs text-gray-400 block">
                          <HardDrive size={12} className="inline mr-1" /> {tenant.max_storage_gb || 10} GB Storage
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={tenant.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-blue-600 hover:bg-blue-50 border-blue-200"
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setModifyForm({
                              plan_type: (tenant.plan || 'freetong').toLowerCase(),
                              billing_cycle: 'monthly',
                            });
                            setIsModifyOpen(true);
                          }}
                        >
                          Modify Plan
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PageShell>

      {/* MODIFY SUBSCRIPTION MODAL */}
      <Modal isOpen={isModifyOpen && !!selectedTenant} onClose={() => setIsModifyOpen(false)} title="Change Plan & Billing Tiers" size="sm">
        {selectedTenant && (
          <form onSubmit={handleModifySubmit} className="space-y-4">
            <div className="pb-3 border-b border-gray-100 dark:border-gray-700">
              <span className="text-[10px] text-gray-400 uppercase font-bold block">Target Tenant</span>
              <span className="font-bold text-gray-800 dark:text-gray-100">{selectedTenant.name}</span>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Select Subscription Plan *</label>
              <select
                value={modifyForm.plan_type}
                onChange={(e) => setModifyForm({ ...modifyForm, plan_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-100"
              >
                <option value="freetong">Freetong (Basic Trial) — Le 400/mo</option>
                <option value="combra">Combra (Standard) — Le 900/mo</option>
                <option value="bintumani">Bintumani (Enterprise) — Le 1,750/mo</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Billing Cycle *</label>
              <select
                value={modifyForm.billing_cycle}
                onChange={(e) => setModifyForm({ ...modifyForm, billing_cycle: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-100"
              >
                <option value="monthly">Monthly Cycle</option>
                <option value="yearly">Yearly Cycle (Discounted 10 months rate)</option>
              </select>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl p-3.5 flex gap-2">
              <Sparkles size={16} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-700 dark:text-blue-300">
                <span className="font-bold block mb-0.5">Automated update</span>
                Changing the subscription plan will immediately update user limits, file storage allowances, and unlock specific menu items for their schools.
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModifyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700">
                {saving && <Loader2 className="animate-spin mr-1.5" size={14} />}
                Confirm Plan Upgrade
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </MainLayout>
  );
};

export default PlatformSubscriptionsPage;
