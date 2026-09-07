/**
 * TenantDetailPage — /platform/tenants/:tenantId
 *
 * The single place a super admin manages everything about one school (tenant):
 *   Overview   — live stats + status
 *   Profile    — edit name, contacts, address, limits
 *   Subscription — change plan
 *   Email Sender — platform vs. school's own (post-verification)
 *   Danger Zone  — suspend / activate / delete
 *
 * All actions are super-admin only and hit the /api/v1/platform endpoints.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2, ArrowLeft, Loader2, Users, GraduationCap, Save, Mail, CreditCard,
  ShieldAlert, Pause, Play, Trash2, Globe, Phone, MapPin, Info, Receipt,
  UserCog, ScrollText, KeyRound, Unlock, ShieldOff, LogIn, RefreshCw, RotateCcw,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import platformService, { PlatformTenant } from '@services/platformService';

type Tab = 'overview' | 'profile' | 'subscription' | 'billing' | 'users' | 'email' | 'audit' | 'danger';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Info size={15} /> },
  { id: 'profile', label: 'Profile & Limits', icon: <Building2 size={15} /> },
  { id: 'subscription', label: 'Subscription', icon: <CreditCard size={15} /> },
  { id: 'billing', label: 'Billing', icon: <Receipt size={15} /> },
  { id: 'users', label: 'Users', icon: <UserCog size={15} /> },
  { id: 'email', label: 'Email Sender', icon: <Mail size={15} /> },
  { id: 'audit', label: 'Audit', icon: <ScrollText size={15} /> },
  { id: 'danger', label: 'Danger Zone', icon: <ShieldAlert size={15} /> },
];

const money = (amount: number, currency = 'SLE') => `${currency === 'SLE' ? 'Le' : currency} ${Number(amount || 0).toLocaleString()}`;

const PLANS = [
  { value: 'freetong', label: 'Freetong (Free)' },
  { value: 'combra', label: 'Combra' },
  { value: 'bintumani', label: 'Bintumani' },
];

export const TenantDetailPage: React.FC = () => {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('overview');
  const [tenant, setTenant] = useState<PlatformTenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile form
  const [form, setForm] = useState({
    name: '', contactEmail: '', contactPhone: '', address: '', domain: '', maxUsers: 0, maxStorageGb: 0,
  });

  // Subscription
  const [plan, setPlan] = useState('freetong');
  const [planCycle, setPlanCycle] = useState<'monthly' | 'yearly'>('monthly');

  // Email sender
  const [emailSender, setEmailSender] = useState<{ mode: 'platform' | 'own'; verified: boolean; fromAddress: string | null; contactEmail: string | null } | null>(null);
  const [emailFrom, setEmailFrom] = useState('');

  // Billing
  const [billing, setBillingData] = useState<{ history: any[]; subscription: any } | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);

  // Users
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [tempPwd, setTempPwd] = useState<{ email: string; pass: string } | null>(null);

  // Audit
  const [audit, setAudit] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Danger
  const [confirm, setConfirm] = useState<null | 'suspend' | 'activate' | 'delete' | 'restore'>(null);
  const [suspendReason, setSuspendReason] = useState('');

  const load = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const res = await platformService.getTenant(tenantId);
      if (res.success && res.data) {
        const t = res.data as PlatformTenant;
        setTenant(t);
        setForm({
          name: t.name || '',
          contactEmail: t.contact_email || '',
          contactPhone: t.contact_phone || '',
          address: t.address || '',
          domain: t.domain || '',
          maxUsers: t.max_users || 0,
          maxStorageGb: t.max_storage_gb || 0,
        });
      }
      const es = await platformService.getTenantEmailSender(tenantId).catch(() => null);
      if (es?.success && es.data) {
        setEmailSender(es.data);
        setEmailFrom(es.data.fromAddress || es.data.contactEmail || '');
      }
    } catch {
      showToast.error('Failed to load tenant');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenantId]);

  const saveProfile = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      // Backend TenantService.updateTenant expects camelCase keys.
      const res = await platformService.updateTenant(tenantId, {
        name: form.name,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        address: form.address,
        domain: form.domain,
        maxUsers: form.maxUsers,
        maxStorageGb: form.maxStorageGb,
      } as any);
      if (res.success) { showToast.success('Tenant updated'); load(); }
      else showToast.error((res as any).error || 'Update failed');
    } catch (e: any) {
      showToast.error(e?.response?.data?.error || 'Update failed');
    } finally { setSaving(false); }
  };

  const changePlan = async () => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const res = await platformService.changeTenantSubscription(tenantId, plan, planCycle);
      if (res.success) { showToast.success(res.message || 'Subscription updated'); load(); }
      else showToast.error((res as any).error || 'Failed to change plan');
    } catch (e: any) {
      showToast.error(e?.response?.data?.error || 'Failed to change plan');
    } finally { setSaving(false); }
  };

  // Lazy-load tab data when a tab is first opened.
  useEffect(() => {
    if (!tenantId) return;
    if (tab === 'billing' && !billing) loadBilling();
    if (tab === 'users' && users.length === 0) loadUsers();
    if (tab === 'audit' && audit.length === 0) loadAudit();
    // eslint-disable-next-line
  }, [tab, tenantId]);

  const loadBilling = async () => {
    if (!tenantId) return;
    setBillingBusy(true);
    try {
      const res = await platformService.getTenantBilling(tenantId);
      if (res.success && res.data) setBillingData(res.data);
    } catch { showToast.error('Failed to load billing'); }
    finally { setBillingBusy(false); }
  };

  const loadUsers = async () => {
    if (!tenantId) return;
    setUsersLoading(true);
    try {
      const res = await platformService.getTenantUsers(tenantId);
      if (res.success && res.data) setUsers(res.data);
    } catch { showToast.error('Failed to load users'); }
    finally { setUsersLoading(false); }
  };

  const loadAudit = async () => {
    if (!tenantId) return;
    setAuditLoading(true);
    try {
      const res = await platformService.getAudit({ tenantId, limit: 100 });
      if (res.success && res.data) setAudit(res.data);
    } catch { showToast.error('Failed to load audit'); }
    finally { setAuditLoading(false); }
  };

  const renew = async (cycle: 'monthly' | 'yearly') => {
    if (!tenantId) return;
    setBillingBusy(true);
    try {
      const res = await platformService.renewSubscription(tenantId, cycle);
      if (res.success) { showToast.success(res.message || 'Renewed'); loadBilling(); load(); }
    } catch (e: any) { showToast.error(e?.response?.data?.error || 'Renew failed'); }
    finally { setBillingBusy(false); }
  };

  const extend = async () => {
    if (!tenantId) return;
    const days = Number(window.prompt('Extend by how many days?', '14'));
    if (!days || days <= 0) return;
    setBillingBusy(true);
    try {
      const res = await platformService.extendSubscription(tenantId, days);
      if (res.success) { showToast.success(res.message || 'Extended'); loadBilling(); load(); }
    } catch (e: any) { showToast.error(e?.response?.data?.error || 'Extend failed'); }
    finally { setBillingBusy(false); }
  };

  const expireSub = async () => {
    if (!tenantId) return;
    setBillingBusy(true);
    try {
      const res = await platformService.expireSubscription(tenantId);
      if (res.success) { showToast.success(res.message || 'Expired'); loadBilling(); load(); }
    } catch (e: any) { showToast.error(e?.response?.data?.error || 'Expire failed'); }
    finally { setBillingBusy(false); }
  };

  const resetPwd = async (userId: string) => {
    if (!tenantId) return;
    try {
      const res = await platformService.resetTenantUserPassword(tenantId, userId);
      if (res.success && res.data) setTempPwd({ email: res.data.email, pass: res.data.tempPassword });
    } catch (e: any) { showToast.error(e?.response?.data?.error || 'Reset failed'); }
  };

  const toggleUserStatus = async (u: any) => {
    if (!tenantId) return;
    const next = u.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await platformService.setTenantUserStatus(tenantId, u.id, next);
      if (res.success) { showToast.success(`User ${next === 'active' ? 'activated' : 'deactivated'}`); loadUsers(); }
    } catch (e: any) { showToast.error(e?.response?.data?.error || 'Failed'); }
  };

  const unlockUser = async (userId: string) => {
    if (!tenantId) return;
    try {
      const res = await platformService.unlockTenantUser(tenantId, userId);
      if (res.success) { showToast.success('User unlocked'); loadUsers(); }
    } catch (e: any) { showToast.error(e?.response?.data?.error || 'Failed'); }
  };

  const disable2fa = async (userId: string) => {
    if (!tenantId) return;
    try {
      const res = await platformService.disableTenantUser2FA(tenantId, userId);
      if (res.success) { showToast.success('2FA disabled'); loadUsers(); }
    } catch (e: any) { showToast.error(e?.response?.data?.error || 'Failed'); }
  };

  const impersonate = async (userId?: string) => {
    if (!tenantId) return;
    try {
      const res = await platformService.impersonateTenant(tenantId, userId);
      if (res.success && res.data) {
        // Preserve the super admin session so Exit can restore it later.
        const origin = {
          accessToken: localStorage.getItem('accessToken'),
          user: localStorage.getItem('user'),
        };
        sessionStorage.setItem('wiskul.impersonation.origin', JSON.stringify(origin));
        sessionStorage.setItem('wiskul.impersonation.active', JSON.stringify({ schoolName: res.data.user.schoolName }));

        // Swap the active session to the impersonated user; a reload re-inits
        // the auth store from localStorage.
        localStorage.setItem('accessToken', res.data.access_token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        showToast.success(res.message || 'Impersonation started');
        window.location.href = '/dashboard';
      }
    } catch (e: any) { showToast.error(e?.response?.data?.error || 'Impersonation failed'); }
  };

  const saveEmailSender = async (mode: 'platform' | 'own') => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const res = await platformService.setTenantEmailSender(tenantId, mode, mode === 'own' ? emailFrom.trim() || undefined : undefined);
      if (res.success) {
        showToast.success(res.message || 'Email sender updated');
        setEmailSender((p) => p ? { ...p, mode, verified: mode === 'own', fromAddress: mode === 'own' ? (emailFrom.trim() || p.contactEmail) : null } : p);
      } else showToast.error((res as any).error || 'Failed');
    } catch (e: any) {
      showToast.error(e?.response?.data?.error || 'Failed');
    } finally { setSaving(false); }
  };

  const runDanger = async () => {
    if (!tenantId || !confirm) return;
    setSaving(true);
    try {
      if (confirm === 'suspend') {
        const res = await platformService.suspendTenant(tenantId, suspendReason || 'Suspended by platform admin');
        if (res.success) showToast.success('Tenant suspended');
      } else if (confirm === 'activate') {
        const res = await platformService.activateTenant(tenantId);
        if (res.success) showToast.success('Tenant activated');
      } else if (confirm === 'delete') {
        const res = await platformService.deleteTenant(tenantId);
        if (res.success) { showToast.success('Tenant deleted'); navigate('/platform/tenants'); return; }
      } else if (confirm === 'restore') {
        const res = await platformService.restoreTenant(tenantId);
        if (res.success) showToast.success('Tenant restored');
      }
      load();
    } catch (e: any) {
      showToast.error(e?.response?.data?.error || 'Action failed');
    } finally { setSaving(false); setConfirm(null); setSuspendReason(''); }
  };

  // Backend getTenantById returns `statistics: { totalUsers, totalStudents, activeUsers }`.
  // The list endpoint returns `stats: { usersCount, studentsCount, staffCount }`.
  // Support both shapes so the Overview never shows empty zeros.
  const stats = useMemo(() => {
    const t: any = tenant;
    if (!t) return undefined;
    if (t.statistics) {
      return {
        usersCount: t.statistics.totalUsers ?? 0,
        studentsCount: t.statistics.totalStudents ?? 0,
        staffCount: t.statistics.activeUsers ?? 0,
      };
    }
    return t.stats;
  }, [tenant]);

  const usage = useMemo(() => (tenant as any)?.usage || null, [tenant]);

  return (
    <MainLayout>
      <PageShell
        title={tenant?.name || 'Tenant'}
        subtitle="Manage everything about this school"
        breadcrumbs={[
          { label: 'Platform Dashboard', path: '/platform/dashboard' },
          { label: 'Tenants', path: '/platform/tenants' },
          { label: tenant?.name || 'Detail' },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/platform/tenants')}>
            <ArrowLeft size={15} className="mr-1.5" /> Back
          </Button>
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-24 text-gray-400"><Loader2 className="animate-spin" size={28} /></div>
        ) : !tenant ? (
          <div className="py-24 text-center text-gray-400">Tenant not found.</div>
        ) : (
          <>
            {/* Header card */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-5 mb-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                  <Building2 size={26} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-black text-slate-900 truncate">{tenant.name}</h2>
                  <p className="text-xs text-gray-400 font-mono">{tenant.slug}</p>
                </div>
              </div>
              <StatusBadge status={(tenant.status === 'trial' ? 'pending' : tenant.status === 'expired' ? 'inactive' : tenant.status) as any} showDot />
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-slate-100 rounded-2xl">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl transition-all font-semibold ${
                    tab === t.id
                      ? (t.id === 'danger' ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md shadow-red-500/30' : 'bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white shadow-md shadow-blue-500/30')
                      : 'text-gray-600 hover:text-blue-700 hover:bg-white/70'
                  }`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* ── Overview ── */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard icon={<Users size={20} />} tint="blue" label="Users" value={stats?.usersCount ?? 0} />
                <StatCard icon={<GraduationCap size={20} />} tint="emerald" label="Students" value={stats?.studentsCount ?? 0} />
                <StatCard icon={<Building2 size={20} />} tint="amber" label="Active Users" value={stats?.staffCount ?? 0} />

                {/* Usage vs plan limits */}
                {usage && (
                  <div className="sm:col-span-3 bg-white rounded-2xl ring-1 ring-gray-200/70 p-5 space-y-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Usage vs Plan Limits</p>
                    <UsageBar label="Students" current={usage.students.current} max={usage.students.max} />
                    <UsageBar label="Staff" current={usage.staff.current} max={usage.staff.max} />
                    <UsageBar label="Users" current={usage.users.current} max={usage.users.max} />
                  </div>
                )}

                <div className="sm:col-span-3 bg-white rounded-2xl ring-1 ring-gray-200/70 p-5 space-y-2 text-sm">
                  <Row icon={<Globe size={14} />} label="Domain" value={tenant.domain || 'Internal default'} />
                  <Row icon={<Mail size={14} />} label="Contact email" value={tenant.contact_email || '—'} />
                  <Row icon={<Phone size={14} />} label="Contact phone" value={tenant.contact_phone || '—'} />
                  <Row icon={<MapPin size={14} />} label="Address" value={tenant.address || '—'} />
                  <Row icon={<Users size={14} />} label="Limits" value={`${tenant.max_users || 0} users · ${tenant.max_storage_gb || 0} GB`} />
                </div>
              </div>
            )}

            {/* ── Profile ── */}
            {tab === 'profile' && (
              <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-6 max-w-2xl space-y-4">
                <Field label="School Name"><input className="inp" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Contact Email"><input className="inp" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></Field>
                  <Field label="Contact Phone"><input className="inp" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></Field>
                </div>
                <Field label="Address"><input className="inp" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
                <Field label="Custom Domain (optional)"><input className="inp" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="school.edu.sl" /></Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Max Users"><input type="number" className="inp" value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: Number(e.target.value) })} /></Field>
                  <Field label="Max Storage (GB)"><input type="number" className="inp" value={form.maxStorageGb} onChange={(e) => setForm({ ...form, maxStorageGb: Number(e.target.value) })} /></Field>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={saveProfile} disabled={saving} className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold">
                    {saving ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <Save size={16} className="mr-1.5" />} Save Changes
                  </Button>
                </div>
              </div>
            )}

            {/* ── Subscription ── */}
            {tab === 'subscription' && (
              <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-6 max-w-xl space-y-4">
                <p className="text-sm text-gray-500">Change the plan for <strong>{tenant.name}</strong>.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Plan">
                    <select className="inp" value={plan} onChange={(e) => setPlan(e.target.value)}>
                      {PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Billing Cycle">
                    <select className="inp" value={planCycle} onChange={(e) => setPlanCycle(e.target.value as any)}>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button onClick={changePlan} disabled={saving} className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold">
                    {saving ? <Loader2 size={16} className="animate-spin mr-1.5" /> : <CreditCard size={16} className="mr-1.5" />} Apply Plan
                  </Button>
                </div>
              </div>
            )}

            {/* ── Billing ── */}
            {tab === 'billing' && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-bold">Current period</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {billing?.subscription
                          ? `${(billing.subscription.plan_type || '').toUpperCase()} · ${billing.subscription.status} · ends ${billing.subscription.end_date ? new Date(billing.subscription.end_date).toLocaleDateString() : '—'}`
                          : '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => renew('monthly')} disabled={billingBusy} className="bg-emerald-600 hover:bg-emerald-700 text-white"><RefreshCw size={14} className="mr-1.5" /> Renew Monthly</Button>
                      <Button size="sm" onClick={() => renew('yearly')} disabled={billingBusy} variant="outline">Renew Yearly</Button>
                      <Button size="sm" onClick={extend} disabled={billingBusy} variant="outline">Extend…</Button>
                      <Button size="sm" onClick={expireSub} disabled={billingBusy} variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50">Force Expire</Button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 text-sm font-bold text-gray-700">Billing History</div>
                  {billingBusy ? (
                    <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
                  ) : !billing || billing.history.length === 0 ? (
                    <div className="py-10 text-center text-sm text-gray-400">No billing records yet.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white">
                          <th className="px-5 py-2.5 text-left text-xs font-bold uppercase">Date</th>
                          <th className="px-5 py-2.5 text-left text-xs font-bold uppercase">Amount</th>
                          <th className="px-5 py-2.5 text-left text-xs font-bold uppercase">Status</th>
                          <th className="px-5 py-2.5 text-left text-xs font-bold uppercase">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {billing.history.map((h, i) => (
                          <tr key={h.id || i} className={i % 2 ? 'bg-sky-50' : 'bg-white'}>
                            <td className="px-5 py-2.5 text-gray-600">{h.billing_date ? new Date(h.billing_date).toLocaleDateString() : '—'}</td>
                            <td className="px-5 py-2.5 font-mono text-gray-800">{money(h.amount, h.currency)}</td>
                            <td className="px-5 py-2.5"><span className="text-xs font-bold text-emerald-600 capitalize">{h.status}</span></td>
                            <td className="px-5 py-2.5 text-gray-500">{h.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ── Users ── */}
            {tab === 'users' && (
              <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">Tenant Users</span>
                  <Button size="sm" variant="outline" onClick={() => impersonate()}><LogIn size={14} className="mr-1.5" /> Enter as Principal</Button>
                </div>
                {usersLoading ? (
                  <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
                ) : users.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">No users in this tenant.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white">
                          <th className="px-4 py-2.5 text-left text-xs font-bold uppercase">Name</th>
                          <th className="px-4 py-2.5 text-left text-xs font-bold uppercase">Role</th>
                          <th className="px-4 py-2.5 text-left text-xs font-bold uppercase">Status</th>
                          <th className="px-4 py-2.5 text-left text-xs font-bold uppercase">2FA</th>
                          <th className="px-4 py-2.5 text-right text-xs font-bold uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {users.map((u, i) => (
                          <tr key={u.id} className={i % 2 ? 'bg-sky-50' : 'bg-white'}>
                            <td className="px-4 py-2.5">
                              <p className="font-semibold text-gray-800">{u.first_name} {u.last_name}</p>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </td>
                            <td className="px-4 py-2.5 capitalize text-gray-600">{(u.role || '').replace('_', ' ')}</td>
                            <td className="px-4 py-2.5"><span className={`text-xs font-bold ${u.status === 'active' ? 'text-emerald-600' : 'text-gray-400'}`}>{u.status}</span></td>
                            <td className="px-4 py-2.5">{u.two_factor_enabled ? <span className="text-xs font-bold text-blue-600">On</span> : <span className="text-xs text-gray-400">Off</span>}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                <button onClick={() => resetPwd(u.id)} title="Reset password" className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"><KeyRound size={15} /></button>
                                <button onClick={() => unlockUser(u.id)} title="Unlock / reactivate" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><Unlock size={15} /></button>
                                {u.two_factor_enabled && (
                                  <button onClick={() => disable2fa(u.id)} title="Disable 2FA" className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"><ShieldOff size={15} /></button>
                                )}
                                <button onClick={() => toggleUserStatus(u)} title={u.status === 'active' ? 'Deactivate' : 'Activate'} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100">{u.status === 'active' ? <Pause size={15} /> : <Play size={15} />}</button>
                                <button onClick={() => impersonate(u.id)} title="Enter as this user" className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50"><LogIn size={15} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── Audit ── */}
            {tab === 'audit' && (
              <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 text-sm font-bold text-gray-700">Audit Trail</div>
                {auditLoading ? (
                  <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
                ) : audit.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">No audit entries for this tenant.</div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {audit.map((a, i) => (
                      <li key={a.id || i} className="px-5 py-3 flex items-start gap-3 text-sm">
                        <ScrollText size={15} className="text-gray-300 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-gray-800"><span className="font-semibold">{a.action}</span></p>
                          <p className="text-xs text-gray-400">
                            {(a.actor_first_name || a.actor_email || 'system')} {a.actor_last_name || ''} · {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* ── Email Sender ── */}
            {tab === 'email' && (
              <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-6 max-w-2xl space-y-4">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  <strong>Setup step:</strong> switch to “School’s own email” only <em>after</em> verifying the school’s
                  sender/domain in Brevo. Otherwise keep the platform sender (delivers reliably).
                </div>
                {!emailSender ? (
                  <div className="py-8 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
                ) : (
                  <>
                    <div className="text-sm">Current: <span className={`font-bold ${emailSender.mode === 'own' ? 'text-emerald-600' : 'text-blue-600'}`}>{emailSender.mode === 'own' ? "School's own email" : 'Platform sender'}</span></div>
                    <label className={`block rounded-xl border p-4 cursor-pointer ${emailSender.mode === 'platform' ? 'border-blue-400 ring-2 ring-blue-500/20 bg-blue-50/40' : 'border-gray-200'}`}>
                      <div className="flex items-start gap-3">
                        <input type="radio" checked={emailSender.mode === 'platform'} onChange={() => setEmailSender({ ...emailSender, mode: 'platform' })} className="mt-1" />
                        <div><p className="font-semibold text-sm">Platform sender (default)</p><p className="text-xs text-gray-500 mt-0.5">Platform address, school’s name, reply-to school. Works immediately.</p></div>
                      </div>
                    </label>
                    <label className={`block rounded-xl border p-4 cursor-pointer ${emailSender.mode === 'own' ? 'border-emerald-400 ring-2 ring-emerald-500/20 bg-emerald-50/40' : 'border-gray-200'}`}>
                      <div className="flex items-start gap-3">
                        <input type="radio" checked={emailSender.mode === 'own'} onChange={() => setEmailSender({ ...emailSender, mode: 'own' })} className="mt-1" />
                        <div className="flex-1">
                          <p className="font-semibold text-sm">School’s own verified email</p>
                          <p className="text-xs text-gray-500 mt-0.5 mb-2">Requires domain verified in Brevo.</p>
                          <input type="email" className="inp" value={emailFrom} onChange={(e) => setEmailFrom(e.target.value)} placeholder="noreply@school.edu.sl" disabled={emailSender.mode !== 'own'} />
                        </div>
                      </div>
                    </label>
                    <div className="flex justify-end">
                      <Button onClick={() => saveEmailSender(emailSender.mode)} disabled={saving || (emailSender.mode === 'own' && !emailFrom.trim())} className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold">
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Danger Zone ── */}
            {tab === 'danger' && (
              <div className="bg-white rounded-2xl ring-1 ring-red-200 shadow-sm p-6 max-w-2xl space-y-4">
                <div className="flex items-center gap-2 text-red-700">
                  <ShieldAlert size={18} /> <h3 className="font-bold">Danger Zone</h3>
                </div>
                <p className="text-sm text-gray-500">These actions affect the school’s access to the platform. Proceed carefully.</p>

                <div className="flex flex-col sm:flex-row gap-3">
                  {tenant.status === 'suspended' ? (
                    <Button onClick={() => setConfirm('activate')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                      <Play size={15} className="mr-1.5" /> Activate Tenant
                    </Button>
                  ) : (
                    <Button onClick={() => setConfirm('suspend')} variant="outline" className="text-amber-700 border-amber-300 hover:bg-amber-50">
                      <Pause size={15} className="mr-1.5" /> Suspend Tenant
                    </Button>
                  )}
                  {tenant.status === 'expired' && (
                    <Button onClick={() => setConfirm('restore')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                      <RotateCcw size={15} className="mr-1.5" /> Restore Tenant
                    </Button>
                  )}
                  <Button onClick={() => setConfirm('delete')} variant="outline" className="text-red-600 border-red-300 hover:bg-red-50">
                    <Trash2 size={15} className="mr-1.5" /> Delete Tenant
                  </Button>
                </div>

                {confirm === 'suspend' && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-2">
                    <label className="text-xs font-bold text-amber-800 uppercase tracking-wider">Reason for suspension</label>
                    <input className="inp" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="e.g. Non-payment" />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>Cancel</Button>
                      <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" disabled={saving} onClick={runDanger}>Confirm Suspend</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <ConfirmationDialog
          isOpen={confirm === 'delete' || confirm === 'activate' || confirm === 'restore'}
          onClose={() => setConfirm(null)}
          onConfirm={runDanger}
          title={confirm === 'delete' ? 'Delete Tenant' : confirm === 'restore' ? 'Restore Tenant' : 'Activate Tenant'}
          message={confirm === 'delete'
            ? `Archive "${tenant?.name}"? The school loses access; you can restore it later.`
            : confirm === 'restore'
              ? `Restore "${tenant?.name}" to active with its original name and slug?`
              : `Reactivate "${tenant?.name}"? Users will regain access.`}
          confirmLabel={confirm === 'delete' ? 'Delete' : confirm === 'restore' ? 'Restore' : 'Activate'}
        />

        {/* Temp password reveal (shown once) */}
        {tempPwd && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setTempPwd(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 text-blue-700"><KeyRound size={18} /><h3 className="font-bold">Temporary Password</h3></div>
              <p className="text-sm text-gray-600">Share this one-time password with <strong>{tempPwd.email}</strong>. It won't be shown again.</p>
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 text-center">
                <code className="text-lg font-black tracking-wider text-gray-900">{tempPwd.pass}</code>
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(tempPwd.pass); showToast.success('Copied'); }}>Copy</Button>
                <Button size="sm" className="bg-[#1d4ed8] text-white" onClick={() => setTempPwd(null)}>Done</Button>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

// ── Sub-components ──
const TINTS: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600' };
const StatCard: React.FC<{ icon: React.ReactNode; tint: string; label: string; value: number }> = ({ icon, tint, label, value }) => (
  <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 shadow-sm p-5 flex items-center gap-4">
    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${TINTS[tint]}`}>{icon}</span>
    <div><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-extrabold text-gray-900">{value}</p></div>
  </div>
);
const Row: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-2 text-gray-600">
    <span className="text-gray-400">{icon}</span>
    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">{label}</span>
    <span className="text-sm text-gray-800 truncate">{value}</span>
  </div>
);
const UsageBar: React.FC<{ label: string; current: number; max: number }> = ({ label, current, max }) => {
  const unlimited = max >= 99999;
  const pct = unlimited ? 0 : Math.min(100, Math.round((current / Math.max(1, max)) * 100));
  const color = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold mb-1 text-gray-600">
        <span>{label}</span>
        <span className={pct >= 80 && !unlimited ? 'text-amber-600' : 'text-gray-500'}>
          {current}{unlimited ? ' / Unlimited' : ` / ${max}`}
        </span>
      </div>
      <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
        <div className={`${unlimited ? 'bg-emerald-400' : color} h-full rounded-full`} style={{ width: unlimited ? '8%' : `${pct}%` }} />
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</label>
    {children}
  </div>
);

export default TenantDetailPage;
