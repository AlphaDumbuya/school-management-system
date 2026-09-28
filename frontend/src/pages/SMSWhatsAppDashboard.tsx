/**
 * SMS & WhatsApp Dashboard
 * Phase 2.4 — Communication hub for SMS/WhatsApp management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Send, Phone, BarChart2,
  Plus, Trash2, Edit2, TestTube2, CheckCircle,
  Clock, RefreshCw, X, ShieldOff, Download, Upload, KeyRound,
  History, ChevronDown, ChevronRight, RotateCcw, Search, CalendarClock, Pause, Play,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { Badge } from '@components/ui/badge';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import apiClient from '@lib/apiClient';
import { saveBlob } from '@lib/download';
import useAuth from '@hooks/useAuth';

// apiClient never rejects on API errors — it resolves with { success: false, error }.
// Wrap mutating calls in assertOk() so try/catch blocks below actually catch failures
// instead of silently treating a failed request as a success.
function assertOk<T>(res: T): T {
  const r = res as unknown as { success?: boolean; error?: string };
  if (r && r.success === false) {
    throw new Error(r.error || 'Request failed');
  }
  return res;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'providers' | 'templates' | 'send' | 'schedules' | 'history' | 'phones' | 'optouts' | 'analytics';

interface Provider {
  provider_id: string;
  provider_name: string;
  provider_type: string;
  phone_number: string;
  enabled: boolean;
  is_primary: boolean;
  configuration?: {
    brevo_whatsapp_template_id?: string;
    messagebird_whatsapp_channel_id?: string;
  };
}

interface MessageTemplate {
  template_id: string;
  template_name: string;
  template_type: string;
  channel: 'sms' | 'whatsapp';
  sms_content: string;
  whatsapp_content?: string;
  variables_required?: string[];
  is_active: boolean;
}

interface PhoneNumber {
  phone_id: string;
  phone_number: string;
  phone_type: string;
  verified: boolean;
  is_primary: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  verification_delivery_error?: string;
}

interface Analytics {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_cost: number;
  delivery_rate: number;
}

interface OptOut {
  optout_id: string;
  user_id: string;
  channel: string;
  reason: string | null;
  status: string;
  created_at: string;
}

interface MessagingSettings {
  stop_keywords: string[];
  start_keywords: string[];
  default_language: string;
}

interface RecipientResult {
  id: string;
  name: string;
  email: string;
  role: string;
  phone_number: string;
}

interface SMSMessage {
  message_id: string;
  recipient_id: string;
  recipient_phone_number: string;
  channel: string;
  message_content: string;
  message_type: string;
  status: string;
  provider_message_id?: string;
  message_parts: number;
  cost?: number;
  error_code?: string;
  error_message?: string;
  sent_at?: string;
  delivered_at?: string;
  created_at: string;
}

interface DeliveryLog {
  log_id: string;
  status: string;
  error_code?: string;
  error_message?: string;
  attempt_number: number;
  retry_count: number;
  log_time: string;
}

interface MessageSchedule {
  schedule_id: string;
  recipient_id: string;
  channel: 'sms' | 'whatsapp';
  message_content?: string;
  schedule_type: 'once' | 'daily' | 'weekly' | 'monthly';
  first_send_time: string;
  next_send_time?: string;
  max_occurrences?: number;
  occurrences_sent: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
}

// ── Shared field styles ───────────────────────────────────────────────────────

const fieldCls = 'w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
const cardCls  = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { key: 'providers', label: 'Providers',    icon: <Settings size={16} />,  adminOnly: true },
  { key: 'templates', label: 'Templates',    icon: <Edit2 size={16} />,     adminOnly: true },
  { key: 'send',      label: 'Send Message', icon: <Send size={16} /> },
  { key: 'schedules', label: 'Schedules',    icon: <CalendarClock size={16} /> },
  { key: 'history',   label: 'Message History', icon: <History size={16} /> },
  { key: 'phones',    label: 'My Numbers',   icon: <Phone size={16} /> },
  { key: 'optouts',   label: 'Opt-Outs',     icon: <ShieldOff size={16} />, adminOnly: true },
  { key: 'analytics', label: 'Analytics',    icon: <BarChart2 size={16} />, adminOnly: true },
];

const MESSAGE_STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  pending: 'warning',
  sent: 'default',
  delivered: 'success',
  read: 'success',
  failed: 'destructive',
  bounced: 'destructive',
  blocked: 'secondary',
};

const PROVIDER_TYPES = ['twilio', 'brevo', 'messagebird', 'custom'];
const TEMPLATE_TYPES = [
  'event_reminder', 'attendance_alert', 'grade_notification', 'payment_reminder',
  'disciplinary_action', 'enrollment_confirmation', 'schedule_update', 'general',
];

// ── Main Component ────────────────────────────────────────────────────────────

export const SMSWhatsAppDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('send');
  const [refreshKey, setRefreshKey] = useState(0);
  const { user } = useAuth();
  const isAdmin = ['principal', 'super_admin'].includes(user?.role || '');
  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <MainLayout>
      <PageShell
        title="SMS & WhatsApp"
        subtitle="Manage messaging providers, templates, and communications"
        breadcrumbs={[{ label: 'SMS & WhatsApp' }]}
        onRefresh={async () => setRefreshKey(k => k + 1)}
      >
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0
                ${activeTab === tab.key
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300'
                }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'providers' && <ProvidersTab key={refreshKey} />}
        {activeTab === 'templates' && <TemplatesTab key={refreshKey} />}
        {activeTab === 'send'      && <SendTab key={refreshKey} />}
        {activeTab === 'schedules' && <SchedulesTab key={refreshKey} />}
        {activeTab === 'history'   && <HistoryTab key={refreshKey} />}
        {activeTab === 'phones'    && <PhonesTab key={refreshKey} />}
        {activeTab === 'optouts'   && <OptOutsTab key={refreshKey} />}
        {activeTab === 'analytics' && <AnalyticsTab key={refreshKey} />}

        {/* Tips footer */}
        <div className={`mt-8 p-4 ${cardCls} border-l-4 border-l-gray-400`}>
          <p className="text-sm font-semibold text-gray-800 dark:text-white mb-2">Quick Tips</p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• <strong>Providers:</strong> Configure Twilio, Brevo, or MessageBird before sending messages</li>
            <li>• <strong>Templates:</strong> Create reusable templates with {'{{variable}}'} placeholders</li>
            <li>• <strong>Phone Numbers:</strong> Verify your number before enabling SMS or WhatsApp</li>
            <li>• <strong>Analytics:</strong> Track delivery rates and costs per provider</li>
          </ul>
        </div>
      </PageShell>
    </MainLayout>
  );
};

export default SMSWhatsAppDashboard;

// ── Providers Tab ─────────────────────────────────────────────────────────────

const ProvidersTab: React.FC = () => {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Provider | null>(null);
  const [form, setForm] = useState({
    provider_name: 'twilio', provider_type: 'sms', phone_number: '', api_key: '',
    account_sid: '', auth_token: '', brevo_whatsapp_template_id: '',
    messagebird_whatsapp_channel_id: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = assertOk(await apiClient.get('/api/v1/sms-whatsapp/providers'));
      setProviders(((res as any)?.data ?? []) as Provider[]);
    } catch (err: any) {
      setProviders([]);
      showToast.apiError(err?.message || 'Failed to load providers');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({
      provider_name: 'twilio', provider_type: 'sms', phone_number: '', api_key: '',
      account_sid: '', auth_token: '', brevo_whatsapp_template_id: '',
      messagebird_whatsapp_channel_id: '',
    });
    setShowForm(true);
  };

  const openEdit = (p: Provider) => {
    setEditTarget(p);
    setForm({
      provider_name: p.provider_name,
      provider_type: p.provider_type,
      phone_number: p.phone_number || '',
      api_key: '',
      account_sid: '',
      auth_token: '',
      brevo_whatsapp_template_id: p.configuration?.brevo_whatsapp_template_id || '',
      messagebird_whatsapp_channel_id: p.configuration?.messagebird_whatsapp_channel_id || '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const configuration = {
        ...(form.brevo_whatsapp_template_id ? { brevo_whatsapp_template_id: form.brevo_whatsapp_template_id } : {}),
        ...(form.messagebird_whatsapp_channel_id ? { messagebird_whatsapp_channel_id: form.messagebird_whatsapp_channel_id } : {}),
      };
      const payload = {
        provider_name: form.provider_name,
        provider_type: form.provider_type,
        phone_number: form.phone_number,
        ...(form.api_key ? { api_key: form.api_key } : {}),
        ...(form.account_sid ? { account_sid: form.account_sid } : {}),
        ...(form.auth_token ? { auth_token: form.auth_token } : {}),
        ...(Object.keys(configuration).length ? { configuration } : {}),
      };
      if (editTarget) {
        assertOk(await apiClient.patch(`/api/v1/sms-whatsapp/providers/${editTarget.provider_id}`, payload));
        showToast.saved('Provider');
      } else {
        assertOk(await apiClient.post('/api/v1/sms-whatsapp/providers', payload));
        showToast.success('Provider added');
      }
      setShowForm(false);
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to save provider'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this provider?')) return;
    try {
      assertOk(await apiClient.delete(`/api/v1/sms-whatsapp/providers/${id}`));
      showToast.deleted('Provider');
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to delete provider'); }
  };

  const handleTest = async (id: string) => {
    try {
      const response = assertOk(await apiClient.post(`/api/v1/sms-whatsapp/providers/${id}/test`, {})) as any;
      const result = response?.data;
      if (result?.status !== 'connected') {
        throw new Error(result?.error_message || 'Connection test failed');
      }
      showToast.success('Connection successful');
    } catch (err: any) { showToast.apiError(err?.message || 'Connection test failed'); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      assertOk(await apiClient.patch(`/api/v1/sms-whatsapp/providers/${id}/toggle`, { enabled: !active }));
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to update provider'); }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      assertOk(await apiClient.put(`/api/v1/sms-whatsapp/providers/${id}/set-primary`, {}));
      showToast.success('Primary provider updated');
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to set primary provider'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Messaging Providers</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Configure your SMS and WhatsApp service providers</p>
        </div>
        <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1.5" />Add Provider</Button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className={`${cardCls} p-5 mb-5 space-y-4`}>
          <p className="font-semibold text-sm text-gray-900 dark:text-white">
            {editTarget ? 'Edit Provider' : 'New Provider'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Provider <span className="text-red-500">*</span></label>
              <select className={fieldCls} value={form.provider_name} disabled={Boolean(editTarget)} onChange={e => setForm(f => ({ ...f, provider_name: e.target.value }))}>
                {PROVIDER_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Channels <span className="text-red-500">*</span></label>
              <select className={fieldCls} value={form.provider_type} onChange={e => setForm(f => ({ ...f, provider_type: e.target.value }))}>
                <option value="sms">SMS only</option>
                <option value="whatsapp">WhatsApp only</option>
                <option value="both">SMS &amp; WhatsApp</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Sender Number <span className="text-red-500">*</span></label>
              <input className={fieldCls} value={form.phone_number} onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))} placeholder="+232760000000" required />
            </div>
            {form.provider_name !== 'twilio' && (
              <div>
                <label className={labelCls}>API Key <span className="text-red-500">{editTarget ? '' : '*'}</span></label>
                <input className={fieldCls} type="password" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} placeholder={editTarget ? 'Leave blank to keep the existing key' : 'Paste your API key'} required={!editTarget} />
              </div>
            )}
            {form.provider_name === 'twilio' && (
              <>
                <div>
                  <label className={labelCls}>Account SID <span className="text-red-500">{editTarget ? '' : '*'}</span></label>
                  <input className={fieldCls} value={form.account_sid} onChange={e => setForm(f => ({ ...f, account_sid: e.target.value }))} placeholder={editTarget ? 'Leave blank to keep the existing SID' : 'ACxxxxxxxxxxxxxxxx'} required={!editTarget} />
                </div>
                <div>
                  <label className={labelCls}>Auth Token <span className="text-red-500">{editTarget ? '' : '*'}</span></label>
                  <input className={fieldCls} type="password" value={form.auth_token} onChange={e => setForm(f => ({ ...f, auth_token: e.target.value }))} placeholder={editTarget ? 'Leave blank to keep the existing token' : 'Paste your Twilio auth token'} required={!editTarget} />
                </div>
              </>
            )}
            {form.provider_name === 'brevo' && form.provider_type !== 'sms' && (
              <div>
                <label className={labelCls}>Brevo WhatsApp Template ID <span className="text-gray-400 font-normal text-xs">(required by Brevo)</span></label>
                <input className={fieldCls} inputMode="numeric" value={form.brevo_whatsapp_template_id} onChange={e => setForm(f => ({ ...f, brevo_whatsapp_template_id: e.target.value }))} placeholder="e.g. 123" />
              </div>
            )}
            {form.provider_name === 'messagebird' && form.provider_type !== 'sms' && (
              <div>
                <label className={labelCls}>MessageBird WhatsApp Channel ID <span className="text-gray-400 font-normal text-xs">(from Conversations)</span></label>
                <input className={fieldCls} value={form.messagebird_whatsapp_channel_id} onChange={e => setForm(f => ({ ...f, messagebird_whatsapp_channel_id: e.target.value }))} placeholder="WhatsApp channel ID" />
              </div>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="submit" size="sm">{editTarget ? 'Update' : 'Add Provider'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4"><SkeletonCard /><SkeletonCard /></div>
      ) : providers.length === 0 ? (
        <EmptyState message="No providers configured" description="Add a provider to start sending SMS or WhatsApp messages" />
      ) : (
        <div className="space-y-3">
          {providers.map(p => (
            <div key={p.provider_id} className={`${cardCls} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white capitalize">{p.provider_name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 capitalize">{p.provider_type}</span>
                  {p.is_primary && <span className="text-xs px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">Primary</span>}
                  <StatusBadge status={p.enabled ? 'active' : 'inactive'} showDot />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {p.phone_number}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => handleTest(p.provider_id)}>
                  <TestTube2 size={13} className="mr-1" />Test
                </Button>
                {!p.is_primary && (
                  <Button variant="outline" size="sm" onClick={() => handleSetPrimary(p.provider_id)}>Set Primary</Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleToggle(p.provider_id, p.enabled)}>
                  {p.enabled ? 'Disable' : 'Enable'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Edit2 size={14} /></Button>
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => handleDelete(p.provider_id)}>
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Templates Tab ─────────────────────────────────────────────────────────────

const TemplatesTab: React.FC = () => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<MessageTemplate | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState({ template_name: '', template_type: 'general', channel: 'sms' as 'sms' | 'whatsapp', content: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = assertOk(await apiClient.get('/api/v1/sms-whatsapp/templates', {
        params: typeFilter ? { type: typeFilter } : {},
      }));
      setTemplates(((res as any)?.data ?? []) as MessageTemplate[]);
    } catch (err: any) {
      setTemplates([]);
      showToast.apiError(err?.message || 'Failed to load templates');
    } finally { setLoading(false); }
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ template_name: '', template_type: 'general', channel: 'sms', content: '' });
    setShowForm(true);
  };

  const openEdit = (t: MessageTemplate) => {
    setEditTarget(t);
    setForm({
      template_name: t.template_name,
      template_type: t.template_type,
      channel: t.channel,
      content: t.channel === 'whatsapp' ? (t.whatsapp_content || t.sms_content) : t.sms_content,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const variables_required = form.content.match(/\{\{(\w+)\}\}/g)?.map(v => v.slice(2, -2)) ?? [];
      const payload = {
        template_name: form.template_name,
        template_type: form.template_type,
        channel: form.channel,
        sms_content: form.content,
        ...(form.channel === 'whatsapp' ? { whatsapp_content: form.content } : {}),
        ...(variables_required.length ? { variables_required } : {}),
      };
      if (editTarget) {
        assertOk(await apiClient.patch(`/api/v1/sms-whatsapp/templates/${editTarget.template_id}`, payload));
        showToast.saved('Template');
      } else {
        assertOk(await apiClient.post('/api/v1/sms-whatsapp/templates', payload));
        showToast.success('Template created');
      }
      setShowForm(false);
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to save template'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      assertOk(await apiClient.delete(`/api/v1/sms-whatsapp/templates/${id}`));
      showToast.deleted('Template');
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to delete template'); }
  };

  const vars = form.content.match(/\{\{(\w+)\}\}/g)?.map(v => v.slice(2, -2)) ?? [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Message Templates</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Reusable templates with {'{{variable}}'} placeholders</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            className={`${fieldCls} w-44 py-1.5 text-xs`}
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {TEMPLATE_TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
          <Button size="sm" onClick={openAdd}><Plus size={14} className="mr-1.5" />New Template</Button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className={`${cardCls} p-5 mb-5 space-y-4`}>
          <p className="font-semibold text-sm text-gray-900 dark:text-white">
            {editTarget ? 'Edit Template' : 'New Template'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Template Name <span className="text-red-500">*</span></label>
              <input className={fieldCls} value={form.template_name} onChange={e => setForm(f => ({ ...f, template_name: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={fieldCls} value={form.template_type} onChange={e => setForm(f => ({ ...f, template_type: e.target.value }))}>
                {TEMPLATE_TYPES.map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Channel</label>
              <select className={fieldCls} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value as 'sms' | 'whatsapp' }))}>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>
              Content <span className="text-gray-400 font-normal text-xs ml-1">— use {'{{variable_name}}'} for placeholders</span>
              <span className="text-red-500 ml-0.5">*</span>
            </label>
            <textarea
              className={fieldCls}
              rows={4}
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
              placeholder="Dear {{student_name}}, your attendance rate is {{attendance_rate}}%."
              required
            />
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-gray-500">
                {form.content.length} characters · {Math.ceil(form.content.length / 160) || 1} SMS part{Math.ceil(form.content.length / 160) !== 1 ? 's' : ''}
              </span>
              {vars.length > 0 && (
                <>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">Variables:</span>
                  {vars.map(v => (
                    <span key={v} className="text-xs px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded-full text-gray-600 dark:text-gray-400">{v}</span>
                  ))}
                </>
              )}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="submit" size="sm">{editTarget ? 'Update' : 'Create Template'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : templates.length === 0 ? (
        <EmptyState message="No templates yet" description="Create a reusable template to speed up your communications" />
      ) : (
        <div className="space-y-3">
          {templates.map(t => (
            <div key={t.template_id} className={`${cardCls} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900 dark:text-white">{t.template_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                      {t.template_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 capitalize">{t.channel}</span>
                    <StatusBadge status={t.is_active ? 'active' : 'inactive'} showDot />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{t.channel === 'whatsapp' ? (t.whatsapp_content || t.sms_content) : t.sms_content}</p>
                  {(t.variables_required?.length ?? 0) > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {(t.variables_required ?? []).map(v => (
                        <span key={v} className="text-xs px-1.5 py-0.5 border border-gray-200 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400">{v}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Edit2 size={14} /></Button>
                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => handleDelete(t.template_id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Send Tab ──────────────────────────────────────────────────────────────────

const SendTab: React.FC = () => {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [useTemplate, setUseTemplate] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  // Recipient picker — searches only users with a verified, channel-enabled
  // phone number (backend requires a recipient_id, not a raw phone string).
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientResults, setRecipientResults] = useState<RecipientResult[]>([]);
  const [searchingRecipients, setSearchingRecipients] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<RecipientResult[]>([]);

  useEffect(() => {
    apiClient.get('/api/v1/sms-whatsapp/templates')
      .then(res => {
        assertOk(res);
        setTemplates(((res as any)?.data ?? []) as MessageTemplate[]);
      })
      .catch((err: any) => showToast.apiError(err?.message || 'Failed to load templates'));
  }, []);

  // Switching channel invalidates prior recipient picks (eligibility differs
  // per-channel), so clear the selection and any in-flight search.
  useEffect(() => {
    setSelectedRecipients([]);
    setRecipientQuery('');
    setRecipientResults([]);
  }, [channel]);

  useEffect(() => {
    const q = recipientQuery.trim();
    if (q.length < 2) { setRecipientResults([]); return; }
    setSearchingRecipients(true);
    const handle = setTimeout(async () => {
      try {
        const res = assertOk(await apiClient.get('/api/v1/sms-whatsapp/recipients/search', { params: { q, channel } }));
        setRecipientResults(((res as any)?.data ?? []) as RecipientResult[]);
      } catch { setRecipientResults([]); }
      finally { setSearchingRecipients(false); }
    }, 300);
    return () => clearTimeout(handle);
  }, [recipientQuery, channel]);

  const visibleResults = recipientResults.filter(r => !selectedRecipients.some(s => s.id === r.id));

  const addRecipient = (r: RecipientResult) => {
    setSelectedRecipients(prev => prev.some(s => s.id === r.id) ? prev : [...prev, r]);
    setRecipientQuery('');
  };
  const removeRecipient = (id: string) => setSelectedRecipients(prev => prev.filter(r => r.id !== id));

  const activeTemplate = templates.find(t => t.template_id === selectedTemplate);
  const vars = activeTemplate?.variables_required ?? [];
  const activeTemplateContent = activeTemplate
    ? (channel === 'whatsapp' ? (activeTemplate.whatsapp_content || activeTemplate.sms_content) : activeTemplate.sms_content)
    : '';

  const preview = useTemplate && activeTemplate
    ? vars.reduce(
        (msg, v) => msg.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), variables[v] || `{{${v}}}`),
        activeTemplateContent
      )
    : customMessage;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRecipients.length === 0) { showToast.error('Search and select at least one recipient'); return; }
    if (useTemplate && !selectedTemplate) { showToast.error('Choose a template'); return; }
    if (!useTemplate && !customMessage.trim()) { showToast.error('Enter a message'); return; }

    setSending(true);
    try {
      const payload = {
        channel,
        template_id: useTemplate && selectedTemplate ? selectedTemplate : undefined,
        message_content: !useTemplate ? customMessage : undefined,
        template_variables: Object.keys(variables).length ? variables : undefined,
      };

      if (selectedRecipients.length === 1) {
        assertOk(await apiClient.post('/api/v1/sms-whatsapp/messages/send', {
          ...payload,
          recipient_id: selectedRecipients[0].id,
        }));
        showToast.success('Message sent successfully');
      } else {
        const res = assertOk(await apiClient.post('/api/v1/sms-whatsapp/messages/bulk-send', {
          ...payload,
          recipient_ids: selectedRecipients.map(r => r.id),
        }));
        const results = ((res as any)?.data ?? []) as { status: string }[];
        const failedCount = results.filter(r => r.status === 'failed').length;
        if (failedCount > 0) {
          showToast.apiError(`${failedCount} of ${results.length} messages failed to send`);
        } else {
          showToast.success(`${results.length} messages sent successfully`);
        }
      }

      setSelectedRecipients([]);
      setVariables({});
      setCustomMessage('');
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to send message'); }
    finally { setSending(false); }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Send Message</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Send an SMS or WhatsApp message to one or more recipients</p>
      </div>

      <form onSubmit={handleSend} className="space-y-5">
        {/* Channel */}
        <div>
          <label className={labelCls}>Channel</label>
          <div className="flex gap-6 mt-1">
            {(['sms', 'whatsapp'] as const).map(c => (
              <label key={c} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c)} className="text-blue-600" />
                {c === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              </label>
            ))}
          </div>
        </div>

        {/* Recipient picker */}
        <div>
          <label className={labelCls}>Recipients <span className="text-red-500">*</span></label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              className={`${fieldCls} pl-8`}
              value={recipientQuery}
              onChange={e => setRecipientQuery(e.target.value)}
              placeholder="Search by name or email…"
            />
            {searchingRecipients && (
              <span className="absolute right-3 top-2.5 text-xs text-gray-400">Searching…</span>
            )}
            {visibleResults.length > 0 && (
              <div className={`${cardCls} absolute z-10 mt-1 w-full max-h-56 overflow-y-auto shadow-lg`}>
                {visibleResults.map(r => (
                  <button
                    type="button"
                    key={r.id}
                    onClick={() => addRecipient(r)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center justify-between gap-2 border-b last:border-b-0 border-gray-100 dark:border-gray-700"
                  >
                    <span>
                      <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
                      <span className="text-gray-400 text-xs ml-2">{r.phone_number}</span>
                    </span>
                    <span className="text-xs text-gray-400 capitalize">{r.role?.replace(/_/g, ' ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {recipientQuery.trim().length >= 2 && !searchingRecipients && visibleResults.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">
              No eligible recipients found — they need a verified phone number with {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} enabled.
            </p>
          )}
          {selectedRecipients.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {selectedRecipients.map(r => (
                <span key={r.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs">
                  {r.name}
                  <button type="button" onClick={() => removeRecipient(r.id)} className="hover:text-blue-900 dark:hover:text-blue-100 rounded-full">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Template vs custom toggle */}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
            <input type="radio" checked={useTemplate} onChange={() => setUseTemplate(true)} className="text-blue-600" />
            Use a template
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
            <input type="radio" checked={!useTemplate} onChange={() => setUseTemplate(false)} className="text-blue-600" />
            Write custom message
          </label>
        </div>

        {useTemplate ? (
          <>
            <div>
              <label className={labelCls}>Template</label>
              <select
                className={fieldCls}
                value={selectedTemplate}
                onChange={e => { setSelectedTemplate(e.target.value); setVariables({}); }}
              >
                <option value="">— Select a template —</option>
                {templates.filter(t => t.is_active && t.channel === channel).map(t => (
                  <option key={t.template_id} value={t.template_id}>{t.template_name}</option>
                ))}
              </select>
            </div>

            {vars.length > 0 && (
              <div className={`${cardCls} p-4 space-y-3`}>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fill in Template Variables</p>
                {vars.map(v => (
                  <div key={v}>
                    <label className={labelCls}>{v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
                    <input
                      className={fieldCls}
                      value={variables[v] || ''}
                      onChange={e => setVariables(prev => ({ ...prev, [v]: e.target.value }))}
                      placeholder={`Enter ${v.replace(/_/g, ' ')}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div>
            <label className={labelCls}>Message <span className="text-red-500">*</span></label>
            <textarea
              className={fieldCls}
              rows={4}
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              placeholder="Type your message here..."
              required={!useTemplate}
            />
            <p className="text-xs text-gray-500 mt-1">
              {customMessage.length} characters · {Math.ceil(customMessage.length / 160) || 1} SMS part{Math.ceil(customMessage.length / 160) !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className={`${cardCls} p-4`}>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Message Preview</p>
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{preview}</p>
          </div>
        )}

        <Button type="submit" disabled={sending} className="w-full sm:w-auto">
          <Send size={15} className="mr-2" />
          {sending
            ? 'Sending…'
            : selectedRecipients.length > 1
              ? `Send to ${selectedRecipients.length} Recipients`
              : 'Send Message'}
        </Button>
      </form>
    </div>
  );
};

// ── Schedules Tab ─────────────────────────────────────────────────────────────

const SchedulesTab: React.FC = () => {
  const [schedules, setSchedules] = useState<MessageSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recipientQuery, setRecipientQuery] = useState('');
  const [recipientResults, setRecipientResults] = useState<RecipientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipient, setRecipient] = useState<RecipientResult | null>(null);
  const [form, setForm] = useState({
    channel: 'sms' as 'sms' | 'whatsapp',
    message_content: '',
    schedule_type: 'once' as MessageSchedule['schedule_type'],
    first_send_time: '',
    max_occurrences: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = assertOk(await apiClient.get('/api/v1/sms-whatsapp/schedules'));
      setSchedules(((res as any)?.data ?? []) as MessageSchedule[]);
    } catch (err: any) {
      setSchedules([]);
      showToast.apiError(err?.message || 'Failed to load schedules');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const q = recipientQuery.trim();
    if (q.length < 2) { setRecipientResults([]); return; }
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = assertOk(await apiClient.get('/api/v1/sms-whatsapp/recipients/search', { params: { q, channel: form.channel } }));
        setRecipientResults(((res as any)?.data ?? []) as RecipientResult[]);
      } catch { setRecipientResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(handle);
  }, [recipientQuery, form.channel]);

  const openForm = () => {
    setForm({ channel: 'sms', message_content: '', schedule_type: 'once', first_send_time: '', max_occurrences: '' });
    setRecipient(null);
    setRecipientQuery('');
    setRecipientResults([]);
    setShowForm(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient) { showToast.error('Search and select a recipient'); return; }
    if (!form.message_content.trim()) { showToast.error('Enter a message'); return; }
    if (!form.first_send_time) { showToast.error('Choose a future send time'); return; }
    if (new Date(form.first_send_time).getTime() <= Date.now()) { showToast.error('Choose a future send time'); return; }

    setSaving(true);
    try {
      assertOk(await apiClient.post('/api/v1/sms-whatsapp/schedules', {
        recipient_id: recipient.id,
        channel: form.channel,
        message_content: form.message_content,
        schedule_type: form.schedule_type,
        first_send_time: new Date(form.first_send_time).toISOString(),
        ...(form.schedule_type !== 'once' && form.max_occurrences ? { max_occurrences: Number(form.max_occurrences) } : {}),
      }));
      showToast.success('Message scheduled');
      setShowForm(false);
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to schedule message'); }
    finally { setSaving(false); }
  };

  const handleAction = async (schedule: MessageSchedule, action: 'pause' | 'resume' | 'cancel') => {
    if (action === 'cancel' && !confirm('Cancel this scheduled message?')) return;
    setBusyId(schedule.schedule_id);
    try {
      if (action === 'cancel') {
        assertOk(await apiClient.delete(`/api/v1/sms-whatsapp/schedules/${schedule.schedule_id}`));
        showToast.deleted('Schedule');
      } else {
        assertOk(await apiClient.post(`/api/v1/sms-whatsapp/schedules/${schedule.schedule_id}/${action}`, {}));
        showToast.success(action === 'pause' ? 'Schedule paused' : 'Schedule resumed');
      }
      load();
    } catch (err: any) { showToast.apiError(err?.message || `Failed to ${action} schedule`); }
    finally { setBusyId(null); }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Scheduled Messages</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Schedule one-time or recurring custom SMS and WhatsApp messages</p>
        </div>
        <Button size="sm" onClick={openForm}><Plus size={14} className="mr-1.5" />Schedule Message</Button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className={`${cardCls} p-5 mb-5 space-y-4 max-w-2xl`}>
          <p className="font-semibold text-sm text-gray-900 dark:text-white">New Scheduled Message</p>
          <div>
            <label className={labelCls}>Channel</label>
            <div className="flex gap-6 mt-1">
              {(['sms', 'whatsapp'] as const).map(channel => (
                <label key={channel} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                  <input type="radio" checked={form.channel === channel} onChange={() => { setForm(f => ({ ...f, channel })); setRecipient(null); setRecipientQuery(''); }} />
                  {channel === 'sms' ? 'SMS' : 'WhatsApp'}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Recipient <span className="text-red-500">*</span></label>
            {recipient ? (
              <div className={`${fieldCls} flex items-center justify-between`}>
                <span className="text-sm">{recipient.name} <span className="text-gray-400">{recipient.phone_number}</span></span>
                <button type="button" onClick={() => setRecipient(null)} className="text-gray-400 hover:text-gray-700"><X size={15} /></button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                <input className={`${fieldCls} pl-8`} value={recipientQuery} onChange={e => setRecipientQuery(e.target.value)} placeholder="Search by name or email…" />
                {searching && <span className="absolute right-3 top-2.5 text-xs text-gray-400">Searching…</span>}
                {recipientResults.length > 0 && (
                  <div className={`${cardCls} absolute z-10 mt-1 w-full max-h-52 overflow-y-auto shadow-lg`}>
                    {recipientResults.map(result => (
                      <button type="button" key={result.id} onClick={() => { setRecipient(result); setRecipientQuery(''); setRecipientResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b last:border-b-0 border-gray-100 dark:border-gray-700">
                        <span className="font-medium text-gray-900 dark:text-white">{result.name}</span>
                        <span className="text-gray-400 text-xs ml-2">{result.phone_number}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Message <span className="text-red-500">*</span></label>
            <textarea className={fieldCls} rows={4} value={form.message_content} onChange={e => setForm(f => ({ ...f, message_content: e.target.value }))} placeholder="Type your message here…" required />
            <p className="text-xs text-gray-500 mt-1">{form.message_content.length} characters · {Math.ceil(form.message_content.length / 160) || 1} SMS part{Math.ceil(form.message_content.length / 160) !== 1 ? 's' : ''}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First Send Time <span className="text-red-500">*</span></label>
              <input type="datetime-local" className={fieldCls} value={form.first_send_time} onChange={e => setForm(f => ({ ...f, first_send_time: e.target.value }))} min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} required />
            </div>
            <div>
              <label className={labelCls}>Repeat</label>
              <select className={fieldCls} value={form.schedule_type} onChange={e => setForm(f => ({ ...f, schedule_type: e.target.value as MessageSchedule['schedule_type'] }))}>
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            {form.schedule_type !== 'once' && (
              <div>
                <label className={labelCls}>Maximum Sends <span className="text-gray-400 font-normal text-xs">optional</span></label>
                <input type="number" min="1" className={fieldCls} value={form.max_occurrences} onChange={e => setForm(f => ({ ...f, max_occurrences: e.target.value }))} placeholder="Leave blank to repeat until cancelled" />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" size="sm" disabled={saving}><CalendarClock size={14} className="mr-1.5" />{saving ? 'Scheduling…' : 'Schedule Message'}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      ) : schedules.length === 0 ? (
        <EmptyState message="No scheduled messages" description="Schedule a message to send it at the right time, even when you are away" />
      ) : (
        <div className="space-y-3">
          {schedules.map(schedule => (
            <div key={schedule.schedule_id} className={`${cardCls} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant={MESSAGE_STATUS_VARIANT[schedule.status] ?? 'secondary'}>{schedule.status}</Badge>
                  <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">{schedule.channel} · {schedule.schedule_type}</span>
                </div>
                <p className="text-sm text-gray-800 dark:text-gray-200 truncate max-w-xl">{schedule.message_content || 'Template message'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Next send: {schedule.next_send_time ? new Date(schedule.next_send_time).toLocaleString() : new Date(schedule.first_send_time).toLocaleString()} · Sent {schedule.occurrences_sent}{schedule.max_occurrences ? ` of ${schedule.max_occurrences}` : ''}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {schedule.status === 'active' && <Button size="sm" variant="outline" disabled={busyId === schedule.schedule_id} onClick={() => handleAction(schedule, 'pause')}><Pause size={13} className="mr-1" />Pause</Button>}
                {schedule.status === 'paused' && <Button size="sm" variant="outline" disabled={busyId === schedule.schedule_id} onClick={() => handleAction(schedule, 'resume')}><Play size={13} className="mr-1" />Resume</Button>}
                {['active', 'paused'].includes(schedule.status) && <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20" disabled={busyId === schedule.schedule_id} onClick={() => handleAction(schedule, 'cancel')}><Trash2 size={14} /></Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Message History Tab ───────────────────────────────────────────────────────

const HistoryTab: React.FC = () => {
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 15;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logsByMessage, setLogsByMessage] = useState<Record<string, DeliveryLog[]>>({});
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = assertOk(await apiClient.get('/api/v1/sms-whatsapp/messages', {
        params: { channel: channelFilter || undefined, status: statusFilter || undefined, limit, offset },
      }));
      setMessages(((res as any)?.data ?? []) as SMSMessage[]);
      setTotal((res as any)?.total ?? 0);
    } catch (err: any) {
      setMessages([]);
      setTotal(0);
      showToast.apiError(err?.message || 'Failed to load message history');
    } finally { setLoading(false); }
  }, [channelFilter, statusFilter, offset]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setOffset(0); }, [channelFilter, statusFilter]);

  const toggleExpand = async (messageId: string) => {
    if (expandedId === messageId) { setExpandedId(null); return; }
    setExpandedId(messageId);
    if (!logsByMessage[messageId]) {
      setLoadingLogs(true);
      try {
        const res = assertOk(await apiClient.get(`/api/v1/sms-whatsapp/messages/${messageId}`));
        const logs = ((res as any)?.data?.delivery_logs ?? []) as DeliveryLog[];
        setLogsByMessage(prev => ({ ...prev, [messageId]: logs }));
      } catch (err: any) { showToast.apiError(err?.message || 'Failed to load delivery details'); }
      finally { setLoadingLogs(false); }
    }
  };

  const handleRetry = async (messageId: string) => {
    setRetryingId(messageId);
    try {
      assertOk(await apiClient.post(`/api/v1/sms-whatsapp/messages/${messageId}/retry`, {}));
      showToast.success('Message resent');
      setLogsByMessage(prev => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Retry failed'); }
    finally { setRetryingId(null); }
  };

  const canRetry = (status: string) => ['failed', 'bounced'].includes(status);
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + limit, total);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Message History</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Track delivery status, errors, and retry failed messages</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className={`${fieldCls} w-32 py-1.5 text-xs`} value={channelFilter} onChange={e => setChannelFilter(e.target.value)}>
            <option value="">All channels</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <select className={`${fieldCls} w-36 py-1.5 text-xs`} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="bounced">Bounced</option>
            <option value="blocked">Blocked</option>
          </select>
          <Button size="sm" variant="outline" onClick={load} aria-label="Refresh">
            <RefreshCw size={13} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : messages.length === 0 ? (
        <EmptyState message="No messages yet" description="Messages you send will show up here with their delivery status" />
      ) : (
        <>
          <div className={cardCls}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {['', 'Recipient', 'Channel', 'Message', 'Status', 'Cost', 'Sent', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {messages.map(m => (
                    <React.Fragment key={m.message_id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => toggleExpand(m.message_id)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                            {expandedId === m.message_id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-xs">{m.recipient_phone_number}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{m.channel}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{m.message_content}</td>
                        <td className="px-4 py-3">
                          <Badge variant={MESSAGE_STATUS_VARIANT[m.status] ?? 'secondary'}>{m.status}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{m.cost != null ? Number(m.cost).toFixed(4) : '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                          {m.sent_at ? new Date(m.sent_at).toLocaleString() : new Date(m.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {canRetry(m.status) && (
                            <Button variant="outline" size="sm" onClick={() => handleRetry(m.message_id)} disabled={retryingId === m.message_id}>
                              <RotateCcw size={13} className="mr-1" />{retryingId === m.message_id ? 'Retrying…' : 'Retry'}
                            </Button>
                          )}
                        </td>
                      </tr>
                      {expandedId === m.message_id && (
                        <tr className="bg-gray-50 dark:bg-gray-900/30">
                          <td colSpan={8} className="px-4 py-4">
                            {(m.error_code || m.error_message) && (
                              <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                                <strong>Error{m.error_code ? ` (${m.error_code})` : ''}:</strong> {m.error_message || 'Unknown error'}
                              </div>
                            )}
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Delivery Attempts</p>
                            {loadingLogs && !logsByMessage[m.message_id] ? (
                              <SkeletonCard />
                            ) : (logsByMessage[m.message_id]?.length ?? 0) === 0 ? (
                              <p className="text-xs text-gray-400">No delivery log entries yet</p>
                            ) : (
                              <div className="space-y-1.5">
                                {logsByMessage[m.message_id].map(log => (
                                  <div key={log.log_id} className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                                    <Badge variant={MESSAGE_STATUS_VARIANT[log.status] ?? 'secondary'}>{log.status}</Badge>
                                    <span>Attempt {log.attempt_number}</span>
                                    {log.error_code && <span className="font-mono">{log.error_code}</span>}
                                    {log.error_message && <span className="truncate max-w-xs">{log.error_message}</span>}
                                    <span className="ml-auto text-gray-400">{log.log_time ? new Date(log.log_time).toLocaleString() : ''}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {rangeStart}–{rangeEnd} of {total}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - limit))}>Previous</Button>
              <Button size="sm" variant="outline" disabled={rangeEnd >= total} onClick={() => setOffset(o => o + limit)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ── Phones Tab ────────────────────────────────────────────────────────────────

const COUNTRY_CODES = [
  { code: '+232', label: 'Sierra Leone (+232)' },
  { code: '+234', label: 'Nigeria (+234)' },
  { code: '+233', label: 'Ghana (+233)' },
  { code: '+1',   label: 'USA / Canada (+1)' },
  { code: '+44',  label: 'UK (+44)' },
  { code: '+61',  label: 'Australia (+61)' },
];

const PhonesTab: React.FC = () => {
  const [phones, setPhones] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [form, setForm] = useState({ country_code: '+232', phone_number: '', phone_type: 'personal' });

  // Self-service resubscribe (opt back in) state
  const [myOptOuts, setMyOptOuts] = useState<OptOut[]>([]);
  const [resubRequested, setResubRequested] = useState(false);
  const [resubCode, setResubCode] = useState('');
  const [resubBusy, setResubBusy] = useState(false);

  const loadMyOptOuts = useCallback(async () => {
    try {
      const res = assertOk(await apiClient.get('/api/v1/sms-whatsapp/opt-outs/me'));
      setMyOptOuts((res as any)?.data ?? []);
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to load opt-out status'); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = assertOk(await apiClient.get('/api/v1/sms-whatsapp/phone-numbers'));
      setPhones(((res as any)?.data ?? []) as PhoneNumber[]);
    } catch (err: any) {
      setPhones([]);
      showToast.apiError(err?.message || 'Failed to load phone numbers');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); loadMyOptOuts(); }, [load, loadMyOptOuts]);

  const handleRequestResubscribe = async () => {
    setResubBusy(true);
    try {
      assertOk(await apiClient.post('/api/v1/sms-whatsapp/opt-outs/resubscribe/request', {}));
      showToast.success('Verification code sent to your phone');
      setResubRequested(true);
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to request resubscribe code'); }
    finally { setResubBusy(false); }
  };

  const handleVerifyResubscribe = async () => {
    if (!resubCode.trim()) return;
    setResubBusy(true);
    try {
      assertOk(await apiClient.post('/api/v1/sms-whatsapp/opt-outs/resubscribe/verify', { verification_code: resubCode }));
      showToast.success('You are resubscribed to messages');
      setResubRequested(false);
      setResubCode('');
      loadMyOptOuts();
    } catch (err: any) { showToast.apiError(err?.message || 'Invalid or expired code'); }
    finally { setResubBusy(false); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = assertOk(await apiClient.post('/api/v1/sms-whatsapp/phone-numbers', {
        ...form,
        phone_number: form.country_code + form.phone_number.replace(/\s/g, ''),
      }));
      const phone = (res as any)?.data as PhoneNumber | undefined;
      if (phone?.verification_delivery_error) {
        const providerMissing = phone.verification_delivery_error.includes('No SMS provider configured');
        showToast.apiError(
          providerMissing
            ? 'Number added, but no enabled SMS provider is configured. Add and enable an SMS provider in the Providers tab, then resend the code.'
            : 'Number added, but the verification code could not be sent. Check the SMS provider status and resend the code.'
        );
      } else {
        showToast.success('Number added — check your phone for a verification code');
      }
      setShowAddForm(false);
      setForm({ country_code: '+232', phone_number: '', phone_type: 'personal' });
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to add phone number'); }
  };

  const handleVerify = async () => {
    if (!verifyTarget || !otp.trim()) return;
    try {
      assertOk(await apiClient.post(`/api/v1/sms-whatsapp/phone-numbers/${verifyTarget}/verify`, { verification_code: otp }));
      showToast.success('Phone number verified');
      setVerifyTarget(null);
      setOtp('');
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Invalid verification code — please try again'); }
  };

  const handleResend = async (id: string) => {
    try {
      assertOk(await apiClient.post(`/api/v1/sms-whatsapp/phone-numbers/${id}/resend-code`, {}));
      showToast.info('Verification code resent');
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to resend code'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this phone number?')) return;
    try {
      assertOk(await apiClient.delete(`/api/v1/sms-whatsapp/phone-numbers/${id}`));
      showToast.deleted('Phone number');
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to remove phone number'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">My Phone Numbers</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Add and verify numbers for SMS and WhatsApp</p>
        </div>
        <Button size="sm" onClick={() => setShowAddForm(v => !v)}>
          <Plus size={14} className="mr-1.5" />Add Number
        </Button>
      </div>

      {myOptOuts.length > 0 && (
        <div className={`${cardCls} p-4 mb-5 border-l-4 border-l-amber-500`}>
          <div className="flex items-center gap-2 mb-1">
            <ShieldOff size={16} className="text-amber-600" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              You've opted out of {myOptOuts.map(o => o.channel).join(', ')} messages
            </p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            You won't receive SMS/WhatsApp messages from the school until you resubscribe.
          </p>
          {!resubRequested ? (
            <Button size="sm" onClick={handleRequestResubscribe} disabled={resubBusy}>
              {resubBusy ? 'Sending…' : 'Request Resubscribe Code'}
            </Button>
          ) : (
            <div className="flex gap-3 flex-wrap items-center">
              <input
                type="text"
                className={`${fieldCls} max-w-[140px]`}
                value={resubCode}
                onChange={e => setResubCode(e.target.value)}
                placeholder="000000"
                maxLength={10}
              />
              <Button size="sm" onClick={handleVerifyResubscribe} disabled={resubBusy}>Verify</Button>
              <Button size="sm" variant="outline" onClick={handleRequestResubscribe} disabled={resubBusy}>Resend Code</Button>
            </div>
          )}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleAdd} className={`${cardCls} p-5 mb-5 space-y-4`}>
          <p className="font-semibold text-sm text-gray-900 dark:text-white">Add Phone Number</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Country</label>
              <select className={fieldCls} value={form.country_code} onChange={e => setForm(f => ({ ...f, country_code: e.target.value }))}>
                {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Phone Number <span className="text-red-500">*</span></label>
              <input
                type="tel"
                className={fieldCls}
                value={form.phone_number}
                onChange={e => setForm(f => ({ ...f, phone_number: e.target.value }))}
                placeholder="76 000 0000"
                required
              />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={fieldCls} value={form.phone_type} onChange={e => setForm(f => ({ ...f, phone_type: e.target.value }))}>
                {['personal', 'home', 'work', 'emergency'].map(t => (
                  <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="submit" size="sm">Add &amp; Send Code</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* OTP entry panel */}
      {verifyTarget && (
        <div className={`${cardCls} p-4 mb-5`}>
          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Enter the 6-digit verification code sent to your phone
          </p>
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              className={`${fieldCls} max-w-[140px]`}
              value={otp}
              onChange={e => setOtp(e.target.value)}
              placeholder="000000"
              maxLength={6}
            />
            <Button size="sm" onClick={handleVerify}>Verify</Button>
            <Button size="sm" variant="outline" onClick={() => handleResend(verifyTarget)}>Resend Code</Button>
            <Button size="sm" variant="ghost" onClick={() => { setVerifyTarget(null); setOtp(''); }}>
              <X size={14} />
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      ) : phones.length === 0 ? (
        <EmptyState message="No phone numbers added" description="Add a phone number and verify it to enable messaging" />
      ) : (
        <div className="space-y-3">
          {phones.map(p => (
            <div key={p.phone_id} className={`${cardCls} p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-900 dark:text-white">{p.phone_number}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 capitalize">{p.phone_type}</span>
                  {p.is_primary && <span className="text-xs px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">Primary</span>}
                  {p.verified
                    ? <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400"><CheckCircle size={12} />Verified</span>
                    : <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"><Clock size={12} />Pending</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {[p.sms_enabled && 'SMS enabled', p.whatsapp_enabled && 'WhatsApp enabled'].filter(Boolean).join(' · ') || 'Not enabled for messaging'}
                </p>
              </div>
              <div className="flex gap-2">
                {!p.verified && (
                  <Button variant="outline" size="sm" onClick={() => setVerifyTarget(p.phone_id)}>Verify</Button>
                )}
                <Button
                  variant="ghost" size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                  onClick={() => handleDelete(p.phone_id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Analytics Tab ─────────────────────────────────────────────────────────────

const AnalyticsTab: React.FC = () => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [daily, setDaily] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = assertOk(await apiClient.get('/api/v1/sms-whatsapp/analytics', {
        params: {
          channel: channel || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      }));
      const rows = ((res as any)?.data ?? []) as any[];
      setDaily(rows);
      setAnalytics(rows.length > 0 ? {
        total_sent: rows.reduce((sum, row) => sum + Number(row.messages_sent ?? 0), 0),
        total_delivered: rows.reduce((sum, row) => sum + Number(row.messages_delivered ?? 0), 0),
        total_failed: rows.reduce((sum, row) => sum + Number(row.messages_failed ?? 0), 0),
        total_cost: rows.reduce((sum, row) => sum + Number(row.total_cost ?? 0), 0),
        delivery_rate: 0,
      } : null);
    } catch (err: any) {
      setAnalytics(null);
      setDaily([]);
      showToast.apiError(err?.message || 'Failed to load messaging analytics');
    } finally { setLoading(false); }
  }, [channel, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const deliveryRate = analytics
    ? Math.round((analytics.total_delivered / Math.max(analytics.total_sent, 1)) * 100)
    : 0;

  return (
    <div>
      {/* Header + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Messaging Analytics</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Delivery rates, costs, and usage statistics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className={`${fieldCls} w-32 py-1.5 text-xs`}
            value={channel}
            onChange={e => setChannel(e.target.value)}
          >
            <option value="">All channels</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          <input type="date" className={`${fieldCls} w-36 py-1.5 text-xs`} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" className={`${fieldCls} w-36 py-1.5 text-xs`} value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <Button size="sm" variant="outline" onClick={load} aria-label="Refresh">
            <RefreshCw size={13} />
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : analytics ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            title="Total Sent"
            value={analytics.total_sent}
            icon={<div className="p-2 rounded-xl bg-blue-500 text-white flex items-center justify-center"><Send size={18} /></div>}
            color="blue"
          />
          <KPICard
            title="Delivered"
            value={analytics.total_delivered}
            icon={<div className="p-2 rounded-xl bg-green-500 text-white flex items-center justify-center"><CheckCircle size={18} /></div>}
            color="green"
          />
          <KPICard
            title="Failed"
            value={analytics.total_failed}
            icon={<div className="p-2 rounded-xl bg-red-500 text-white flex items-center justify-center"><X size={18} /></div>}
            color="red"
          />
          <KPICard
            title="Delivery Rate"
            value={`${deliveryRate}%`}
            icon={
              <div className={`p-2 rounded-xl text-white flex items-center justify-center ${
                deliveryRate >= 90 ? 'bg-green-500' : deliveryRate >= 70 ? 'bg-amber-500' : 'bg-red-500'
              }`}>
                <BarChart2 size={18} />
              </div>
            }
            color={deliveryRate >= 90 ? 'green' : deliveryRate >= 70 ? 'amber' : 'red'}
          />
        </div>
      ) : (
        <div className="mb-6">
          <EmptyState message="No analytics data" description="Send some messages to start seeing delivery statistics here" />
        </div>
      )}

      {/* Daily breakdown table */}
      {daily.length > 0 && (
        <div className={cardCls}>
          <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Daily Breakdown</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {['Date', 'Channel', 'Sent', 'Delivered', 'Failed', 'Cost (USD)'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {daily.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.analytics_date}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{row.channel}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.messages_sent}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.messages_delivered}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.messages_failed}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{Number(row.total_cost ?? 0).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Opt-Outs Tab ──────────────────────────────────────────────────────────────

const OptOutsTab: React.FC = () => {
  const [optOuts, setOptOuts] = useState<OptOut[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ user_id: '', channel: 'sms', reason: '', notes: '' });
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);
  const [exporting, setExporting] = useState(false);

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [stopKeywordsText, setStopKeywordsText] = useState('');
  const [startKeywordsText, setStartKeywordsText] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = assertOk(await apiClient.get('/api/v1/sms-whatsapp/opt-outs', {
        params: { channel: channelFilter || undefined, status: statusFilter || undefined },
      }));
      setOptOuts((res as any)?.data ?? []);
      setTotal((res as any)?.total ?? 0);
    } catch (err: any) {
      setOptOuts([]);
      setTotal(0);
      showToast.apiError(err?.message || 'Failed to load opt-outs');
    } finally { setLoading(false); }
  }, [channelFilter, statusFilter]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = assertOk(await apiClient.get('/api/v1/sms-whatsapp/messaging-settings'));
      const d = (res as any)?.data as MessagingSettings | undefined;
      setStopKeywordsText((d?.stop_keywords ?? []).join(', '));
      setStartKeywordsText((d?.start_keywords ?? []).join(', '));
      setDefaultLanguage(d?.default_language ?? 'en');
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to load messaging settings'); }
    finally { setSettingsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id.trim()) { showToast.error('User ID is required'); return; }
    try {
      assertOk(await apiClient.post('/api/v1/sms-whatsapp/opt-outs', form));
      showToast.success('Opt-out added');
      setShowForm(false);
      setForm({ user_id: '', channel: 'sms', reason: '', notes: '' });
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to add opt-out'); }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this opt-out? The user will start receiving messages again.')) return;
    try {
      assertOk(await apiClient.delete(`/api/v1/sms-whatsapp/opt-outs/${id}`));
      showToast.deleted('Opt-out');
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to remove opt-out'); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await apiClient.get('/api/v1/sms-whatsapp/opt-outs/export', { responseType: 'blob' } as any);
      await saveBlob(blob as unknown as Blob, 'opt-outs.csv');
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to export opt-outs'); }
    finally { setExporting(false); }
  };

  const handleImport = async () => {
    let records: unknown;
    try {
      records = JSON.parse(importText);
      if (!Array.isArray(records)) throw new Error('not an array');
    } catch {
      showToast.error('Enter a valid JSON array of records, e.g. [{ "phone_number": "+232...", "channel": "sms" }]');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const res = assertOk(await apiClient.post('/api/v1/sms-whatsapp/opt-outs/import', { records }));
      const d = (res as any)?.data ?? res;
      setImportResult({ imported: d?.imported ?? 0, failed: d?.failed ?? 0 });
      showToast.success(`Imported ${d?.imported ?? 0} opt-out(s)`);
      setImportText('');
      load();
    } catch (err: any) { showToast.apiError(err?.message || 'Bulk import failed'); }
    finally { setImporting(false); }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const stop_keywords = stopKeywordsText.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      const start_keywords = startKeywordsText.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      assertOk(await apiClient.patch('/api/v1/sms-whatsapp/messaging-settings', {
        stop_keywords, start_keywords, default_language: defaultLanguage,
      }));
      showToast.saved('Messaging settings');
      loadSettings();
    } catch (err: any) { showToast.apiError(err?.message || 'Failed to save messaging settings'); }
    finally { setSavingSettings(false); }
  };

  return (
    <div className="space-y-8">
      {/* Messaging Settings card */}
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={16} className="text-gray-500" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">STOP/START Keywords</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Configure the keywords your school's recipients can reply with to opt out or back in — applied per-tenant to inbound SMS/WhatsApp messages
        </p>
        {settingsLoading ? (
          <SkeletonCard />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Opt-out (STOP) keywords <span className="text-gray-400 font-normal text-xs">comma-separated</span></label>
                <input className={fieldCls} value={stopKeywordsText} onChange={e => setStopKeywordsText(e.target.value)} placeholder="STOP, UNSUBSCRIBE, CANCEL" />
              </div>
              <div>
                <label className={labelCls}>Opt-in (START) keywords <span className="text-gray-400 font-normal text-xs">comma-separated</span></label>
                <input className={fieldCls} value={startKeywordsText} onChange={e => setStartKeywordsText(e.target.value)} placeholder="START, SUBSCRIBE, YES" />
              </div>
              <div>
                <label className={labelCls}>Default Language</label>
                <input className={fieldCls} value={defaultLanguage} onChange={e => setDefaultLanguage(e.target.value)} placeholder="en" />
              </div>
            </div>
            <Button size="sm" onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? 'Saving…' : 'Save Settings'}
            </Button>
          </div>
        )}
      </div>

      {/* Opt-outs list */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Opt-Outs</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Users who have opted out of receiving messages ({total})</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select className={`${fieldCls} w-32 py-1.5 text-xs`} value={channelFilter} onChange={e => setChannelFilter(e.target.value)}>
              <option value="">All channels</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="both">Both</option>
            </select>
            <select className={`${fieldCls} w-32 py-1.5 text-xs`} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="active">Active</option>
              <option value="removed">Removed</option>
              <option value="">All</option>
            </select>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download size={13} className="mr-1.5" />{exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
            <Button size="sm" onClick={() => setShowForm(v => !v)}><Plus size={14} className="mr-1.5" />Add Opt-Out</Button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className={`${cardCls} p-5 mb-5 space-y-4`}>
            <p className="font-semibold text-sm text-gray-900 dark:text-white">Add Opt-Out</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>User ID <span className="text-red-500">*</span></label>
                <input className={fieldCls} value={form.user_id} onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))} placeholder="UUID of the user" required />
              </div>
              <div>
                <label className={labelCls}>Channel</label>
                <select className={fieldCls} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Reason</label>
                <input className={fieldCls} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. manual, complaint" />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <input className={fieldCls} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <Button type="submit" size="sm">Add Opt-Out</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
        ) : optOuts.length === 0 ? (
          <EmptyState message="No opt-outs" description="No one has opted out of messages yet" />
        ) : (
          <div className={cardCls}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {['User', 'Channel', 'Reason', 'Status', 'Date', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {optOuts.map(o => (
                    <tr key={o.optout_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-xs">{o.user_id}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{o.channel}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{o.reason || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={o.status === 'active' ? 'active' : 'inactive'} showDot /></td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {o.status === 'active' && (
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => handleRemove(o.optout_id)}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Bulk import */}
      <div className={`${cardCls} p-5`}>
        <div className="flex items-center gap-2 mb-1">
          <Upload size={16} className="text-gray-500" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Bulk Import Opt-Outs</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Paste a JSON array of records — each needs <code>channel</code> plus either <code>user_id</code> or <code>phone_number</code>
        </p>
        <textarea
          className={fieldCls}
          rows={5}
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder={'[{ "phone_number": "+23276000000", "channel": "sms", "reason": "prior consent withdrawal" }]'}
        />
        <div className="flex items-center gap-3 mt-3">
          <Button size="sm" onClick={handleImport} disabled={importing || !importText.trim()}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
          {importResult && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {importResult.imported} imported · {importResult.failed} failed
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
