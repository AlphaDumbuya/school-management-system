/**
 * SMS & WhatsApp Dashboard
 * Phase 2.4 — Communication hub for SMS/WhatsApp management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings, Send, Phone, BarChart2,
  Plus, Trash2, Edit2, TestTube2, CheckCircle,
  Clock, RefreshCw, X,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import apiClient from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'providers' | 'templates' | 'send' | 'phones' | 'analytics';

interface Provider {
  provider_id: string;
  name: string;
  provider_type: string;
  is_active: boolean;
  is_primary: boolean;
  supports_sms: boolean;
  supports_whatsapp: boolean;
}

interface MessageTemplate {
  template_id: string;
  name: string;
  template_type: string;
  content: string;
  variables: string[];
  is_active: boolean;
}

interface PhoneNumber {
  phone_id: string;
  phone_number: string;
  phone_type: string;
  is_verified: boolean;
  is_primary: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
}

interface Analytics {
  total_sent: number;
  total_delivered: number;
  total_failed: number;
  total_cost: number;
  delivery_rate: number;
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
  { key: 'phones',    label: 'My Numbers',   icon: <Phone size={16} /> },
  { key: 'analytics', label: 'Analytics',    icon: <BarChart2 size={16} />, adminOnly: true },
];

const PROVIDER_TYPES = ['twilio', 'brevo', 'messagebird', 'custom'];
const TEMPLATE_TYPES = [
  'event_reminder', 'attendance_alert', 'grade_notification', 'payment_reminder',
  'disciplinary_action', 'enrollment_confirmation', 'schedule_update', 'general',
];

// ── Main Component ────────────────────────────────────────────────────────────

export const SMSWhatsAppDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('send');
  const userRole = localStorage.getItem('user_role') || '';
  const isAdmin = ['admin', 'principal', 'super_admin'].includes(userRole);
  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <MainLayout>
      <PageShell
        title="SMS & WhatsApp"
        subtitle="Manage messaging providers, templates, and communications"
        breadcrumbs={[{ label: 'SMS & WhatsApp' }]}
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

        {activeTab === 'providers' && <ProvidersTab />}
        {activeTab === 'templates' && <TemplatesTab />}
        {activeTab === 'send'      && <SendTab />}
        {activeTab === 'phones'    && <PhonesTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}

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
    name: '', provider_type: 'twilio', api_key: '',
    account_sid: '', supports_sms: true, supports_whatsapp: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/v1/sms-whatsapp/providers');
      setProviders((res as any)?.data?.providers ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: '', provider_type: 'twilio', api_key: '', account_sid: '', supports_sms: true, supports_whatsapp: false });
    setShowForm(true);
  };

  const openEdit = (p: Provider) => {
    setEditTarget(p);
    setForm({ name: p.name, provider_type: p.provider_type, api_key: '', account_sid: '', supports_sms: p.supports_sms, supports_whatsapp: p.supports_whatsapp });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editTarget) {
        await apiClient.patch(`/api/v1/sms-whatsapp/providers/${editTarget.provider_id}`, form);
        showToast.saved('Provider');
      } else {
        await apiClient.post('/api/v1/sms-whatsapp/providers', form);
        showToast.success('Provider added');
      }
      setShowForm(false);
      load();
    } catch { showToast.apiError('Failed to save provider'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this provider?')) return;
    await apiClient.delete(`/api/v1/sms-whatsapp/providers/${id}`);
    showToast.deleted('Provider');
    load();
  };

  const handleTest = async (id: string) => {
    try {
      await apiClient.post(`/api/v1/sms-whatsapp/providers/${id}/test`, {});
      showToast.success('Connection successful');
    } catch { showToast.apiError('Connection test failed'); }
  };

  const handleToggle = async (id: string, active: boolean) => {
    await apiClient.patch(`/api/v1/sms-whatsapp/providers/${id}`, { is_active: !active });
    load();
  };

  const handleSetPrimary = async (id: string) => {
    await apiClient.put(`/api/v1/sms-whatsapp/providers/${id}/set-primary`, {});
    showToast.success('Primary provider updated');
    load();
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
              <label className={labelCls}>Provider Name <span className="text-red-500">*</span></label>
              <input className={fieldCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Twilio Production" required />
            </div>
            <div>
              <label className={labelCls}>Provider Type</label>
              <select className={fieldCls} value={form.provider_type} onChange={e => setForm(f => ({ ...f, provider_type: e.target.value }))}>
                {PROVIDER_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>API Key</label>
              <input className={fieldCls} type="password" value={form.api_key} onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))} placeholder="Paste your API key" />
            </div>
            <div>
              <label className={labelCls}>Account SID <span className="text-gray-400 font-normal text-xs">(Twilio only)</span></label>
              <input className={fieldCls} value={form.account_sid} onChange={e => setForm(f => ({ ...f, account_sid: e.target.value }))} placeholder="ACxxxxxxxxxxxxxxxx" />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              <input type="checkbox" checked={form.supports_sms} onChange={e => setForm(f => ({ ...f, supports_sms: e.target.checked }))} className="w-4 h-4 rounded border-gray-300" />
              Supports SMS
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              <input type="checkbox" checked={form.supports_whatsapp} onChange={e => setForm(f => ({ ...f, supports_whatsapp: e.target.checked }))} className="w-4 h-4 rounded border-gray-300" />
              Supports WhatsApp
            </label>
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
                  <span className="font-semibold text-gray-900 dark:text-white">{p.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 capitalize">{p.provider_type}</span>
                  {p.is_primary && <span className="text-xs px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">Primary</span>}
                  <StatusBadge status={p.is_active ? 'active' : 'inactive'} showDot />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {[p.supports_sms && 'SMS', p.supports_whatsapp && 'WhatsApp'].filter(Boolean).join(' · ')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => handleTest(p.provider_id)}>
                  <TestTube2 size={13} className="mr-1" />Test
                </Button>
                {!p.is_primary && (
                  <Button variant="outline" size="sm" onClick={() => handleSetPrimary(p.provider_id)}>Set Primary</Button>
                )}
                <Button variant="outline" size="sm" onClick={() => handleToggle(p.provider_id, p.is_active)}>
                  {p.is_active ? 'Disable' : 'Enable'}
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
  const [form, setForm] = useState({ name: '', template_type: 'general', content: '', is_active: true });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/v1/sms-whatsapp/templates', {
        params: typeFilter ? { template_type: typeFilter } : {},
      });
      setTemplates((res as any)?.data?.templates ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ name: '', template_type: 'general', content: '', is_active: true });
    setShowForm(true);
  };

  const openEdit = (t: MessageTemplate) => {
    setEditTarget(t);
    setForm({ name: t.name, template_type: t.template_type, content: t.content, is_active: t.is_active });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editTarget) {
        await apiClient.patch(`/api/v1/sms-whatsapp/templates/${editTarget.template_id}`, form);
        showToast.saved('Template');
      } else {
        await apiClient.post('/api/v1/sms-whatsapp/templates', form);
        showToast.success('Template created');
      }
      setShowForm(false);
      load();
    } catch { showToast.apiError('Failed to save template'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await apiClient.delete(`/api/v1/sms-whatsapp/templates/${id}`);
    showToast.deleted('Template');
    load();
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
              <input className={fieldCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={fieldCls} value={form.template_type} onChange={e => setForm(f => ({ ...f, template_type: e.target.value }))}>
                {TEMPLATE_TYPES.map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
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
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 rounded border-gray-300" />
            Active — visible for selection when sending
          </label>
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
                    <span className="font-semibold text-gray-900 dark:text-white">{t.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                      {t.template_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                    <StatusBadge status={t.is_active ? 'active' : 'inactive'} showDot />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{t.content}</p>
                  {t.variables?.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {t.variables.map(v => (
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
  const [recipient, setRecipient] = useState('');
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    apiClient.get('/api/v1/sms-whatsapp/templates')
      .then(res => setTemplates((res as any)?.data?.templates ?? []))
      .catch(() => {});
  }, []);

  const activeTemplate = templates.find(t => t.template_id === selectedTemplate);
  const vars = activeTemplate?.variables ?? [];

  const preview = useTemplate && activeTemplate
    ? vars.reduce(
        (msg, v) => msg.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'g'), variables[v] || `{{${v}}}`),
        activeTemplate.content
      )
    : customMessage;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim()) { showToast.error('Enter a recipient phone number'); return; }
    setSending(true);
    try {
      await apiClient.post('/api/v1/sms-whatsapp/messages/send', {
        channel,
        recipient_phone: recipient,
        template_id: useTemplate && selectedTemplate ? selectedTemplate : undefined,
        message: !useTemplate ? customMessage : undefined,
        variables: Object.keys(variables).length ? variables : undefined,
      });
      showToast.success('Message sent successfully');
      setRecipient('');
      setVariables({});
      setCustomMessage('');
    } catch { showToast.apiError('Failed to send message'); }
    finally { setSending(false); }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Send Message</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Send a single SMS or WhatsApp message</p>
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

        {/* Recipient */}
        <div>
          <label className={labelCls}>Recipient Phone Number <span className="text-red-500">*</span></label>
          <input
            type="tel"
            className={fieldCls}
            value={recipient}
            onChange={e => setRecipient(e.target.value)}
            placeholder="+232 76 000 0000"
            required
          />
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
                {templates.filter(t => t.is_active).map(t => (
                  <option key={t.template_id} value={t.template_id}>{t.name}</option>
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
          {sending ? 'Sending…' : 'Send Message'}
        </Button>
      </form>
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/api/v1/sms-whatsapp/phone-numbers');
      setPhones((res as any)?.data?.phone_numbers ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/api/v1/sms-whatsapp/phone-numbers', {
        ...form,
        phone_number: form.country_code + form.phone_number.replace(/\s/g, ''),
      });
      showToast.success('Number added — check your phone for a verification code');
      setShowAddForm(false);
      setForm({ country_code: '+232', phone_number: '', phone_type: 'personal' });
      load();
    } catch { showToast.apiError('Failed to add phone number'); }
  };

  const handleVerify = async () => {
    if (!verifyTarget || !otp.trim()) return;
    try {
      await apiClient.post(`/api/v1/sms-whatsapp/phone-numbers/${verifyTarget}/verify`, { otp_code: otp });
      showToast.success('Phone number verified');
      setVerifyTarget(null);
      setOtp('');
      load();
    } catch { showToast.apiError('Invalid verification code — please try again'); }
  };

  const handleResend = async (id: string) => {
    await apiClient.post(`/api/v1/sms-whatsapp/phone-numbers/${id}/resend-code`, {});
    showToast.info('Verification code resent');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this phone number?')) return;
    await apiClient.delete(`/api/v1/sms-whatsapp/phone-numbers/${id}`);
    showToast.deleted('Phone number');
    load();
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
                  {p.is_verified
                    ? <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400"><CheckCircle size={12} />Verified</span>
                    : <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"><Clock size={12} />Pending</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {[p.sms_enabled && 'SMS enabled', p.whatsapp_enabled && 'WhatsApp enabled'].filter(Boolean).join(' · ') || 'Not enabled for messaging'}
                </p>
              </div>
              <div className="flex gap-2">
                {!p.is_verified && (
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
      const res = await apiClient.get('/api/v1/sms-whatsapp/analytics', {
        params: {
          channel: channel || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      });
      const d = (res as any)?.data;
      setAnalytics(d?.summary ?? null);
      setDaily(d?.daily ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
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
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.date}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{row.channel}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{row.sent}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.delivered}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.failed}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{(row.cost ?? 0).toFixed(4)}</td>
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
