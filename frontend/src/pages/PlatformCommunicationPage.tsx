/**
 * PlatformCommunicationPage — /platform/communications
 *
 * The platform operator's communication hub:
 *   Inbox     — inbound messages (contact-form submissions) with read/archive/reply/delete
 *   Broadcast — send an announcement email to schools by audience, with a send history
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Inbox, Send, Loader2, Mail, Building2, Search, Trash2, Archive, CornerUpLeft,
  CheckCheck, Megaphone, Clock,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { SearchBar } from '@components/admin/table/SearchBar';
import { showToast } from '@utils/toast';
import platformService from '../services/platformService';

type Tab = 'inbox' | 'broadcast' | 'newsletter';

const STATUS_TABS = [
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
  { id: 'archived', label: 'Archived' },
  { id: 'all', label: 'All' },
];

export const PlatformCommunicationPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('inbox');

  // Inbox
  const [statusFilter, setStatusFilter] = useState('unread');
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyPurpose, setReplyPurpose] = useState<'info' | 'support' | 'sales'>('support');
  const [replying, setReplying] = useState(false);

  // Broadcast
  const [bSubject, setBSubject] = useState('');
  const [bBody, setBBody] = useState('');
  const [bAudience, setBAudience] = useState<'all' | 'active' | 'trial' | 'suspended'>('all');
  const [bPurpose, setBPurpose] = useState<'info' | 'support' | 'sales'>('info');
  const [sending, setSending] = useState(false);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);

  // Newsletter
  const [subs, setSubs] = useState<any[]>([]);
  const [subCounts, setSubCounts] = useState<{ subscribed: number; unsubscribed: number }>({ subscribed: 0, unsubscribed: 0 });
  const [subStatus, setSubStatus] = useState('subscribed');
  const [subSearch, setSubSearch] = useState('');
  const [subsLoading, setSubsLoading] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [nlSubject, setNlSubject] = useState('');
  const [nlBody, setNlBody] = useState('');
  const [nlSegment, setNlSegment] = useState<'all' | 'tenants' | 'prospects'>('all');
  const [nlSending, setNlSending] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await platformService.getMessages({ status: statusFilter, search: search || undefined, limit: 100 });
      if (res.success) setMessages(res.data || []);
    } catch { showToast.error('Failed to load messages'); }
    finally { setLoading(false); }
  };

  const loadBroadcasts = async () => {
    try {
      const res = await platformService.getBroadcasts();
      if (res.success) setBroadcasts(res.data || []);
    } catch { /* non-fatal */ }
  };

  const loadSubs = async () => {
    setSubsLoading(true);
    try {
      const res = await platformService.getSubscribers({ status: subStatus, search: subSearch || undefined, limit: 100 });
      if (res.success) { setSubs(res.data || []); setSubCounts((res as any).counts || { subscribed: 0, unsubscribed: 0 }); }
    } catch { showToast.error('Failed to load subscribers'); }
    finally { setSubsLoading(false); }
  };

  const loadCampaigns = async () => {
    try { const res = await platformService.getCampaigns(); if (res.success) setCampaigns(res.data || []); } catch { /* non-fatal */ }
  };

  useEffect(() => { if (tab === 'inbox') loadMessages(); /* eslint-disable-next-line */ }, [tab, statusFilter, search]);
  useEffect(() => { if (tab === 'broadcast') loadBroadcasts(); /* eslint-disable-next-line */ }, [tab]);
  useEffect(() => { if (tab === 'newsletter') { loadSubs(); loadCampaigns(); } /* eslint-disable-next-line */ }, [tab, subStatus, subSearch]);

  const addSubscriber = async () => {
    if (!addEmail.trim()) return;
    try { await platformService.addSubscriber(addEmail.trim()); showToast.success('Subscriber added'); setAddEmail(''); loadSubs(); }
    catch (e: any) { showToast.error(e?.response?.data?.error || 'Failed to add'); }
  };

  const toggleSub = async (s: any) => {
    const next = s.status === 'subscribed' ? 'unsubscribed' : 'subscribed';
    try { await platformService.setSubscriberStatus(s.id, next); loadSubs(); }
    catch { showToast.error('Failed'); }
  };

  const sendNewsletter = async () => {
    if (!nlSubject.trim() || !nlBody.trim()) { showToast.warning('Subject and message are required'); return; }
    setNlSending(true);
    try {
      const res = await platformService.sendCampaign({ subject: nlSubject, body: nlBody, segment: nlSegment });
      if (res.success) { showToast.success(res.message || 'Newsletter sent'); setNlSubject(''); setNlBody(''); loadCampaigns(); }
    } catch (e: any) { showToast.error(e?.response?.data?.error || 'Send failed'); }
    finally { setNlSending(false); }
  };

  const openMessage = async (m: any) => {
    setSelected(m);
    setReplySubject(`Re: your message to WiSkul`);
    setReplyBody('');
    if (m.status === 'unread') {
      try { await platformService.setMessageStatus(m.id, 'read'); loadMessages(); } catch { /* ignore */ }
    }
  };

  const archive = async (m: any) => {
    try { await platformService.setMessageStatus(m.id, 'archived'); showToast.success('Archived'); setSelected(null); loadMessages(); }
    catch { showToast.error('Failed'); }
  };

  const remove = async (m: any) => {
    try { await platformService.deleteMessage(m.id); showToast.success('Deleted'); setSelected(null); loadMessages(); }
    catch { showToast.error('Failed'); }
  };

  const sendReply = async () => {
    if (!selected || !replyBody.trim()) return;
    setReplying(true);
    try {
      const res = await platformService.replyMessage(selected.id, replySubject, replyBody, replyPurpose);
      if (res.success) { showToast.success('Reply sent'); setReplyBody(''); loadMessages(); }
    } catch (e: any) { showToast.error(e?.response?.data?.error || 'Reply failed'); }
    finally { setReplying(false); }
  };

  const sendBroadcast = async () => {
    if (!bSubject.trim() || !bBody.trim()) { showToast.warning('Subject and message are required'); return; }
    setSending(true);
    try {
      const res = await platformService.broadcast({ subject: bSubject, body: bBody, audience: bAudience, purpose: bPurpose });
      if (res.success) {
        showToast.success(res.message || 'Broadcast sent');
        setBSubject(''); setBBody('');
        loadBroadcasts();
      }
    } catch (e: any) { showToast.error(e?.response?.data?.error || 'Broadcast failed'); }
    finally { setSending(false); }
  };

  const fmt = (iso: string) => (iso ? new Date(iso).toLocaleString() : '');

  return (
    <MainLayout>
      <PageShell
        title="Communications"
        subtitle="Manage inbound messages and broadcast announcements to schools"
        breadcrumbs={[{ label: 'Platform Dashboard', path: '/platform/dashboard' }, { label: 'Communications' }]}
      >
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6 p-1.5 bg-slate-100 rounded-2xl w-fit">
          {([['inbox', 'Inbox', <Inbox size={15} key="i" />], ['broadcast', 'Broadcast', <Megaphone size={15} key="b" />], ['newsletter', 'Newsletter', <Mail size={15} key="n" />]] as const).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl transition-all font-semibold ${
                tab === id ? 'bg-gradient-to-r from-[#1d4ed8] to-[#3b82f6] text-white shadow-md shadow-blue-500/30' : 'text-gray-600 hover:text-blue-700 hover:bg-white/70'
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {tab === 'inbox' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* List */}
            <div className="lg:col-span-2 space-y-3">
              <SearchBar placeholder="Search messages…" defaultValue={search} onSearch={setSearch} isLoading={loading} />
              <div className="flex flex-wrap gap-1.5">
                {STATUS_TABS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStatusFilter(s.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${statusFilter === s.id ? 'bg-[#1d4ed8] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 overflow-hidden divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
                {loading ? (
                  <div className="py-12 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400">No messages here.</div>
                ) : (
                  messages.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => openMessage(m)}
                      className={`w-full text-left px-4 py-3 hover:bg-sky-50 transition-colors ${selected?.id === m.id ? 'bg-sky-50' : ''}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${m.status === 'unread' ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{m.name}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{fmt(m.created_at)}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{m.school ? `${m.school} · ` : ''}{m.email}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{m.message}</p>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Detail */}
            <div className="lg:col-span-3">
              {!selected ? (
                <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 h-full min-h-[300px] flex items-center justify-center text-gray-400 text-sm">
                  Select a message to read and reply.
                </div>
              ) : (
                <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 p-6 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{selected.name}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Mail size={12} /> {selected.email}{selected.phone ? ` · ${selected.phone}` : ''}</p>
                      {selected.school && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Building2 size={12} /> {selected.school}{selected.role ? ` · ${selected.role}` : ''}</p>}
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => archive(selected)} title="Archive" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><Archive size={16} /></button>
                      <button onClick={() => remove(selected)} title="Delete" className="p-2 rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm text-gray-700 whitespace-pre-wrap">{selected.message}</div>

                  <div className="pt-2 border-t border-gray-100 space-y-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5"><CornerUpLeft size={13} /> Reply by email</p>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-gray-500 shrink-0">Send from</label>
                      <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={replyPurpose} onChange={(e) => setReplyPurpose(e.target.value as any)}>
                        <option value="support">Support (support@)</option>
                        <option value="info">Info (info@)</option>
                        <option value="sales">Sales (sales@)</option>
                      </select>
                    </div>
                    <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={replySubject} onChange={(e) => setReplySubject(e.target.value)} placeholder="Subject" />
                    <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder={`Write a reply to ${selected.name}…`} />
                    <div className="flex justify-end">
                      <Button onClick={sendReply} disabled={replying || !replyBody.trim()} className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold">
                        {replying ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <Send size={15} className="mr-1.5" />} Send Reply
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'broadcast' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Composer */}
            <div className="lg:col-span-3 bg-white rounded-2xl ring-1 ring-gray-200/70 p-6 space-y-4">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Megaphone size={18} className="text-[#1d4ed8]" /> Broadcast to Schools</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Audience</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={bAudience} onChange={(e) => setBAudience(e.target.value as any)}>
                    <option value="all">All schools</option>
                    <option value="active">Active only</option>
                    <option value="trial">Trial only</option>
                    <option value="suspended">Suspended only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Send from</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={bPurpose} onChange={(e) => setBPurpose(e.target.value as any)}>
                    <option value="info">Info (info@)</option>
                    <option value="support">Support (support@)</option>
                    <option value="sales">Sales (sales@)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Subject</label>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={bSubject} onChange={(e) => setBSubject(e.target.value)} placeholder="e.g. Scheduled maintenance this weekend" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Message</label>
                <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[180px] focus:outline-none focus:ring-2 focus:ring-blue-500" value={bBody} onChange={(e) => setBBody(e.target.value)} placeholder="Write your announcement…" />
              </div>
              <div className="flex justify-end">
                <Button onClick={sendBroadcast} disabled={sending || !bSubject.trim() || !bBody.trim()} className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold">
                  {sending ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <Send size={15} className="mr-1.5" />} Send Broadcast
                </Button>
              </div>
            </div>

            {/* History */}
            <div className="lg:col-span-2 bg-white rounded-2xl ring-1 ring-gray-200/70 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 text-sm font-bold text-gray-700 flex items-center gap-1.5"><Clock size={14} /> Recent Broadcasts</div>
              {broadcasts.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No broadcasts sent yet.</div>
              ) : (
                <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                  {broadcasts.map((b) => (
                    <li key={b.id} className="px-5 py-3">
                      <p className="text-sm font-semibold text-gray-800 truncate">{b.subject}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <CheckCheck size={12} className="text-emerald-500" /> {b.delivered_count}/{b.recipients_count} · {b.audience} · {fmt(b.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {tab === 'newsletter' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Composer + history */}
            <div className="lg:col-span-3 space-y-5">
              <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 p-6 space-y-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2"><Mail size={18} className="text-[#1d4ed8]" /> Send Newsletter</h3>
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800">
                  Goes to each school's <strong>contact email</strong> (one per school — never individual staff/students) plus public subscribers. Only <strong>opted-in</strong> recipients are emailed, and every message includes a one-click unsubscribe link.
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Segment</label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={nlSegment} onChange={(e) => setNlSegment(e.target.value as any)}>
                    <option value="all">All subscribers</option>
                    <option value="tenants">Schools (tenants)</option>
                    <option value="prospects">Prospects (public)</option>
                  </select>
                </div>
                <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={nlSubject} onChange={(e) => setNlSubject(e.target.value)} placeholder="Subject" />
                <textarea className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm min-h-[160px] focus:outline-none focus:ring-2 focus:ring-blue-500" value={nlBody} onChange={(e) => setNlBody(e.target.value)} placeholder="Write your newsletter…" />
                <div className="flex justify-end">
                  <Button onClick={sendNewsletter} disabled={nlSending || !nlSubject.trim() || !nlBody.trim()} className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold">
                    {nlSending ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <Send size={15} className="mr-1.5" />} Send Newsletter
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded-2xl ring-1 ring-gray-200/70 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 text-sm font-bold text-gray-700 flex items-center gap-1.5"><Clock size={14} /> Recent Campaigns</div>
                {campaigns.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">No campaigns sent yet.</div>
                ) : (
                  <ul className="divide-y divide-gray-100 max-h-[40vh] overflow-y-auto">
                    {campaigns.map((c) => (
                      <li key={c.id} className="px-5 py-3">
                        <p className="text-sm font-semibold text-gray-800 truncate">{c.subject}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><CheckCheck size={12} className="text-emerald-500" /> {c.delivered_count}/{c.recipients_count} · {c.segment} · {fmt(c.created_at)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Subscribers */}
            <div className="lg:col-span-2 bg-white rounded-2xl ring-1 ring-gray-200/70 overflow-hidden flex flex-col">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">Subscribers</span>
                <span className="text-xs text-gray-400">{subCounts.subscribed} subscribed · {subCounts.unsubscribed} out</span>
              </div>
              <div className="p-3 space-y-2 border-b border-gray-100">
                <SearchBar placeholder="Search subscribers…" defaultValue={subSearch} onSearch={setSubSearch} />
                <div className="flex gap-1.5">
                  {['subscribed', 'unsubscribed', 'all'].map((s) => (
                    <button key={s} onClick={() => setSubStatus(s)} className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${subStatus === s ? 'bg-[#1d4ed8] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{s}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Add subscriber email" />
                  <Button size="sm" onClick={addSubscriber} className="bg-emerald-600 hover:bg-emerald-700 text-white">Add</Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto max-h-[50vh] divide-y divide-gray-100">
                {subsLoading ? (
                  <div className="py-10 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={20} /></div>
                ) : subs.length === 0 ? (
                  <div className="py-10 text-center text-sm text-gray-400">No subscribers.</div>
                ) : (
                  subs.map((s) => (
                    <div key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 truncate">{s.name || s.email}</p>
                        <p className="text-xs text-gray-400 truncate">{s.email} · {s.source}</p>
                      </div>
                      <button onClick={() => toggleSub(s)} className={`text-xs font-semibold px-2 py-1 rounded shrink-0 ${s.status === 'subscribed' ? 'text-amber-700 hover:bg-amber-50' : 'text-emerald-700 hover:bg-emerald-50'}`}>
                        {s.status === 'subscribed' ? 'Unsubscribe' : 'Resubscribe'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default PlatformCommunicationPage;
