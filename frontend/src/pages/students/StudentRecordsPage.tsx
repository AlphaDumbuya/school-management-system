/**
 * StudentRecordsPage: /students/records
 * For students who were enrolled before the system and whose records are incomplete.
 *  - Records: who is missing what, per class. Create personal links for parents (copy, WhatsApp, SMS, CSV or a
 *    printable QR sheet), or fill a record in with the parent present (parents' session) and take the photo.
 *  - To review: details parents sent through their links, with old and new values side by side.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, CheckCircle2, Copy, Download, Link2, MessageCircle, Printer, Search, Smartphone, UserCheck, X } from 'lucide-react';
import QRCode from 'qrcode';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Modal } from '@components/admin/feedback/Modal';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { FileUploader } from '@components/admin/forms/FileUploader';
import { Button } from '@components/ui/button';
import { classesService } from '@services/classesService';
import { studentRecordsService, recordsError, RecordField, RecordLink, RecordRow, RecordValues } from '@services/studentRecordsService';
import { RecordFields } from './components/RecordFields';
import { SharedLinkCard } from './components/SharedLinkCard';
import { WelcomeEditor } from './components/WelcomeEditor';
import { ReviewList } from './components/ReviewList';
import { getBrandSync } from '../../brand/brandStore';
import { saveBlob } from '@lib/download';
import { showToast } from '@utils/toast';

const SELECT = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'incomplete', label: 'Incomplete' },
  { id: 'no_link', label: 'Incomplete, no link yet' },
  { id: 'pending', label: 'Update to review' },
  { id: 'no_photo', label: 'Photo pending' },
  { id: 'complete', label: 'Complete' },
];
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const digits = (p: string) => p.replace(/[^\d]/g, '');
const messageFor = (l: RecordLink, school: string) =>
  `Dear ${l.guardian_name || 'parent'}, ${school} asks you to complete ${l.name}'s school record. Please open your personal link and fill in the form: ${l.url} (valid until ${fmtDate(l.expires_at)}).`;

const StudentRecordsPage: React.FC = () => {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'records' | 'review'>('records');
  const [classId, setClassId] = useState('');
  const [filter, setFilter] = useState('incomplete');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(14);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [links, setLinks] = useState<{ days: number; links: RecordLink[] } | null>(null);
  const [creating, setCreating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [searchInput]);

  const meta = useQuery({ queryKey: ['record-meta'], queryFn: () => studentRecordsService.meta(), staleTime: 3_600_000 });
  const fields: RecordField[] = meta.data?.data?.fields ?? [];
  const labelOf = (key: string) => fields.find((f) => f.key === key)?.label.replace(/ \(.*\)$/, '') || key;
  const classes = useQuery({ queryKey: ['record-classes'], queryFn: () => classesService.listClasses({ limit: 100 } as any), staleTime: 300_000 });
  const classOptions: { id: string; name: string }[] = ((classes.data as any)?.data ?? []).map((c: any) => ({ id: c.id, name: c.name }));

  const list = useQuery({
    queryKey: ['student-records', classId, filter, search, page],
    queryFn: () => studentRecordsService.list({ class_id: classId || undefined, filter, search: search || undefined, page, limit: 50 }),
    placeholderData: (prev) => prev,
  });
  const data = list.data?.data;
  const updates = useQuery({ queryKey: ['record-updates'], queryFn: () => studentRecordsService.updates('pending') });
  const pendingCount = updates.data?.data?.length ?? 0;
  const refreshAll = async () => { await Promise.all([qc.invalidateQueries({ queryKey: ['student-records'] }), qc.invalidateQueries({ queryKey: ['record-updates'] })]); };

  const items = data?.items ?? [];
  const allOnPage = items.length > 0 && items.every((r) => selected.has(r.id));
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const createLinks = async () => {
    if (!selected.size && !classId) { showToast.error('Choose a class, or tick the students first'); return; }
    setCreating(true);
    try {
      const r = await studentRecordsService.createLinks(selected.size ? { student_ids: [...selected], days } : { class_id: classId, only_incomplete: true, days });
      const made = r.data;
      if (!made || !made.count) { showToast.info('Every student in this class already has a complete record'); return; }
      setLinks({ days: made.days, links: made.links });
      setSelected(new Set());
      void refreshAll();
    } catch (e) { showToast.error(recordsError(e, 'Could not create the links')); }
    finally { setCreating(false); }
  };

  const nextAfter = (id: string): string | null => {
    const i = items.findIndex((r) => r.id === id);
    const rest = i >= 0 ? items.slice(i + 1) : items;
    return (rest.find((r) => r.missing.length > 0) ?? rest[0])?.id ?? null;
  };

  return (
    <MainLayout>
      <PageShell title="Student Records" subtitle="Complete the records of students who joined before the system" onRefresh={refreshAll} isRefreshing={list.isFetching} mobileLabels>
        <div role="tablist" aria-label="Student records" className="mb-4 inline-flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900/50">
          {([['records', 'Records'], ['review', `To review${pendingCount ? ` (${pendingCount})` : ''}`]] as const).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === id ? 'bg-white text-primary-800 shadow dark:bg-gray-800 dark:text-white' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400'}`}>{label}</button>
          ))}
        </div>

        {tab === 'records' && (
          <>
            <SharedLinkCard classId={classId} />
            <WelcomeEditor />
            {data && (
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                  ['Students', data.summary.students, ''],
                  ['Average complete', `${data.summary.average_percent}%`, ''],
                  ['Incomplete', data.summary.incomplete, data.summary.incomplete ? 'text-amber-600' : ''],
                  ['Photo pending', data.summary.no_photo, data.summary.no_photo ? 'text-amber-600' : ''],
                  ['To review', data.summary.pending_updates, data.summary.pending_updates ? 'text-primary-700' : ''],
                ].map(([label, value, tone]) => (
                  <div key={String(label)} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                    <p className={`mt-1 text-2xl font-black text-gray-900 dark:text-white ${tone}`}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select aria-label="Class" value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); setSelected(new Set()); }} className={SELECT}>
                <option value="">All classes</option>
                {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select aria-label="Show" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className={SELECT}>
                {FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
              <div className="relative min-w-[12rem] flex-1">
                <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="search" aria-label="Search students" placeholder="Search name or ID" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                  className={`${SELECT} w-full pl-9`} />
              </div>
            </div>

            <details className="mb-4 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <summary className="cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-100">Personal links for individual parents (optional)</summary>
              <p className="mt-2 text-xs text-gray-500">One link per child, for a parent who is not in the group or who needs a reminder. Tick students, or choose a class, then create the links.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-primary-50 p-3 dark:bg-primary-900/20">
              <Link2 size={18} aria-hidden="true" className="text-primary-700" />
              <span className="text-sm text-primary-900 dark:text-primary-100">
                {selected.size ? `${selected.size} selected.` : classId ? 'Links for everyone in this class who is still incomplete.' : 'Choose a class, or tick students, to create parent links.'}
              </span>
              <label className="ml-auto flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                Valid for
                <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={SELECT} aria-label="Days the link works">
                  {[7, 14, 30, 60].map((d) => <option key={d} value={d}>{d} days</option>)}
                </select>
              </label>
              <Button onClick={createLinks} disabled={creating} className="bg-primary-700 text-white hover:bg-primary-800">{creating ? 'Creating…' : 'Create parent links'}</Button>
            </div>
            </details>

            {list.isLoading ? (
              <p className="py-12 text-center text-gray-500">Loading…</p>
            ) : items.length === 0 ? (
              <EmptyState message={data?.summary.students ? 'No students match' : 'No students yet'} description={data?.summary.students ? 'Try another class or filter.' : 'Import your students first (Student Directory → Import), then come back here to complete their records.'} />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <thead className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700">
                    <tr>
                      <th className="w-10 px-3 py-3"><input type="checkbox" aria-label="Select all on this page" checked={allOnPage}
                        onChange={() => setSelected((s) => { const n = new Set(s); items.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id))); return n; })} /></th>
                      <th className="px-3 py-3">Student</th><th className="px-3 py-3">Complete</th><th className="px-3 py-3">Missing</th>
                      <th className="px-3 py-3">Photo</th><th className="px-3 py-3">Parent link</th><th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {items.map((r: RecordRow) => (
                      <tr key={r.id} className="align-top">
                        <td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>
                        <td className="px-3 py-3"><p className="font-semibold text-gray-900 dark:text-white">{r.name}</p><p className="text-xs text-gray-500">{r.student_id}{r.class_name ? ` · ${r.class_name}` : ''}</p></td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2"><div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"><div className={`h-full ${r.percent === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${r.percent}%` }} /></div><span className="text-xs font-semibold">{r.percent}%</span></div>
                        </td>
                        <td className="max-w-[16rem] px-3 py-3 text-xs text-gray-600 dark:text-gray-300">{r.missing.length ? r.missing.map(labelOf).join(', ') : <span className="text-emerald-600">Nothing missing</span>}</td>
                        <td className="px-3 py-3">{r.has_photo ? <Check size={16} className="text-emerald-600" aria-label="Has photo" /> : <Camera size={16} className="text-amber-500" aria-label="Photo pending" />}</td>
                        <td className="px-3 py-3 text-xs">
                          {r.pending_update_id ? <button className="font-semibold text-primary-700 underline" onClick={() => setTab('review')}>Update to review</button>
                            : r.has_link ? (r.link_opened ? 'Opened' : 'Created') : <span className="text-gray-400">None</span>}
                        </td>
                        <td className="px-3 py-3 text-right"><Button size="sm" variant="outline" onClick={() => setSessionId(r.id)}><UserCheck size={14} className="mr-1" /> Fill in</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data && data.total > data.limit && (
              <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
                <span>{(page - 1) * data.limit + 1}–{Math.min(page * data.limit, data.total)} of {data.total}</span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={page * data.limit >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </span>
              </div>
            )}
          </>
        )}

        {tab === 'review' && <ReviewList updates={updates.data?.data ?? []} loading={updates.isLoading} onDone={refreshAll} />}
      </PageShell>

      {links && <LinksModal result={links} onClose={() => setLinks(null)} />}
      {sessionId && (
        <SessionModal studentId={sessionId} fields={fields} onClose={() => setSessionId(null)} onSaved={refreshAll}
          onNext={() => { const n = nextAfter(sessionId); setSessionId(n); }} hasNext={!!nextAfter(sessionId)} />
      )}
    </MainLayout>
  );
};

// ── Links: copy, WhatsApp, SMS, CSV, printable QR sheet ──────────────────────────────────────────────
const LinksModal: React.FC<{ result: { days: number; links: RecordLink[] }; onClose: () => void }> = ({ result, onClose }) => {
  const school = getBrandSync().name;
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); showToast.success(`${what} copied`); } catch { showToast.error('Could not copy. Select the text and copy it by hand.'); }
  };
  const csv = () => {
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Student ID', 'Student', 'Class', 'Parent', 'Phone', 'Email', 'Link', 'Valid until'],
      ...result.links.map((l) => [l.admission_no, l.name, l.class_name, l.guardian_name, l.guardian_phone, l.guardian_email, l.url, fmtDate(l.expires_at)])];
    void saveBlob(new Blob(['\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' }), `parent-links-${new Date().toISOString().slice(0, 10)}.csv`);
  };
  const printSheet = async () => {
    // Open the tab inside the click so the browser does not block it while the QR codes are made.
    const w = window.open('', '_blank');
    if (!w) { showToast.error('Allow pop-ups for this site to print the sheet'); return; }
    w.document.write('<title>Preparing</title><p style="font:16px system-ui;padding:24px">Preparing the QR sheet…</p>');
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const cards = await Promise.all(result.links.map(async (l) => {
      const qr = await QRCode.toDataURL(l.url, { width: 260, margin: 1, errorCorrectionLevel: 'M' });
      return `<div class="c"><p class="s">${esc(school)}</p><p class="n">${esc(l.name)}</p><p class="k">${esc(l.class_name)}</p><img src="${qr}" alt=""/>` +
        `<p class="t">Scan with your phone to complete your child's school record.</p><p class="k">Valid until ${fmtDate(l.expires_at)}</p></div>`;
    }));
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Parent record links</title><style>
      @page{size:A4;margin:10mm}body{font-family:system-ui,Arial,sans-serif;margin:0}
      .g{display:grid;grid-template-columns:1fr 1fr;gap:6mm}.c{border:1px dashed #94a3b8;border-radius:8px;padding:6mm;text-align:center;break-inside:avoid}
      .s{font-size:11px;font-weight:700;color:#475569;margin:0}.n{font-size:17px;font-weight:800;margin:4px 0 0}.k{font-size:11px;color:#64748b;margin:2px 0}
      img{width:42mm;height:42mm;margin:6px 0}.t{font-size:11px;margin:2px 0}</style></head><body><div class="g">${cards.join('')}</div></body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };
  return (
    <Modal isOpen onClose={onClose} title={`${result.links.length} parent link${result.links.length === 1 ? '' : 's'} ready`} size="xl">
      <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
        Each link is personal to one child and works for {result.days} days. <strong>Copy them now:</strong> for safety the links are not shown again
        (creating new links for a student stops the old one).
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => copy(result.links.map((l) => messageFor(l, school)).join('\n\n'), 'All messages')}><Copy size={14} className="mr-1" /> Copy all messages</Button>
        <Button size="sm" variant="outline" onClick={csv}><Download size={14} className="mr-1" /> Download CSV</Button>
        <Button size="sm" variant="outline" onClick={printSheet}><Printer size={14} className="mr-1" /> Print QR sheet</Button>
      </div>
      <ul className="max-h-[50vh] divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-700">
        {result.links.map((l) => {
          const msg = messageFor(l, school);
          const phone = digits(l.guardian_phone);
          return (
            <li key={l.student_id} className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{l.name}</p><p className="truncate text-xs text-gray-500">{l.class_name} · {l.guardian_name || 'No parent name'} {l.guardian_phone && `· ${l.guardian_phone}`}</p></div>
              <Button size="sm" variant="outline" onClick={() => copy(l.url, 'Link')}><Copy size={14} /></Button>
              {phone.length >= 7 && (
                <>
                  <a className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50" target="_blank" rel="noopener noreferrer"
                    href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`}><MessageCircle size={14} /> WhatsApp</a>
                  <a className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50" href={`sms:${l.guardian_phone}?body=${encodeURIComponent(msg)}`}><Smartphone size={14} /> SMS</a>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
};

// ── Parents' session: fill a record in with the parent present ───────────────────────────────────────
const SessionModal: React.FC<{ studentId: string; fields: RecordField[]; onClose: () => void; onSaved: () => void | Promise<void>; onNext: () => void; hasNext: boolean }> =
  ({ studentId, fields, onClose, onSaved, onNext, hasNext }) => {
    const qc = useQueryClient();
    const detail = useQuery({ queryKey: ['record-detail', studentId], queryFn: () => studentRecordsService.detail(studentId), staleTime: 0, gcTime: 0 });
    const d = detail.data?.data;
    const [values, setValues] = useState<RecordValues>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => { if (d) { setValues(d.values); setError(''); } }, [d?.id, d?.name]);

    const save = async (andNext: boolean) => {
      if (!d) return;
      const changed = Object.fromEntries(Object.entries(values).filter(([k, v]) => (d.values[k] || '') !== v && v.trim() !== ''));
      setSaving(true);
      setError('');
      try {
        if (Object.keys(changed).length) await studentRecordsService.saveDirect(studentId, changed);
        await onSaved();
        showToast.success(`${d.name} saved`);
        if (andNext) onNext(); else await qc.invalidateQueries({ queryKey: ['record-detail', studentId] });
      } catch (e) { setError(recordsError(e, 'Could not save')); }
      finally { setSaving(false); }
    };
    const setPhoto = async (url: string) => {
      try {
        await studentRecordsService.setPhoto(studentId, url);
        showToast.success(url ? 'Photo saved' : 'Photo removed');
        await qc.invalidateQueries({ queryKey: ['record-detail', studentId] });
        await onSaved();
      } catch (e) { showToast.error(recordsError(e, 'Could not save the photo')); }
    };

    return (
      <Modal isOpen onClose={onClose} title={d ? `${d.name}${d.class_name ? ` · ${d.class_name}` : ''}` : 'Student record'} size="xl"
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-2">
            {error && <p role="alert" className="mr-auto text-sm font-medium text-red-600">{error}</p>}
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={() => save(false)} disabled={saving || !d} variant="outline">Save</Button>
            {hasNext && <Button onClick={() => save(true)} disabled={saving || !d} className="bg-primary-700 text-white hover:bg-primary-800">Save &amp; next</Button>}
          </div>
        }>
        {!d ? <p className="py-10 text-center text-gray-500">Loading…</p> : (
          <div className="space-y-5">
            {d.missing.length === 0 && <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={16} aria-hidden="true" /> Every required field is filled in.</p>}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <FileUploader label="Student photo (taken at school)" value={d.photo_url || ''} onChange={setPhoto} accept="image/png,image/jpeg,image/webp" maxSizeMB={2}
                placeholder="Take or upload photo" enableCamera previewType="image" />
            </div>
            <RecordFields fields={fields} values={values} onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))} missing={d.missing} idPrefix="s" />
          </div>
        )}
      </Modal>
    );
  };

export default StudentRecordsPage;
