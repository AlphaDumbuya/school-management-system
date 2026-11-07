/**
 * SharedLinkCard: the school's one link for the parents' WhatsApp group.
 * Create it, share it to WhatsApp (the officer picks the group), copy the message, print a QR code, copy the names
 * of children whose records are still incomplete (to post as a reminder), make a new link or close it.
 */
import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, MessageCircle, Printer, UserCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '@components/ui/button';
import { studentRecordsService, recordsError, SharedLink } from '@services/studentRecordsService';
import { getBrandSync } from '../../../brand/brandStore';
import { showToast } from '@utils/toast';

const SELECT = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white';
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const escHtml = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

export const SharedLinkCard: React.FC<{ classId: string }> = ({ classId }) => {
  const qc = useQueryClient();
  const school = getBrandSync().name;
  const q = useQuery({ queryKey: ['record-shared-link'], queryFn: () => studentRecordsService.sharedLink() });
  const link: SharedLink | null = q.data?.data ?? null;
  const [busy, setBusy] = useState(false);
  const [expiry, setExpiry] = useState(0);
  const [text, setText] = useState('');

  useEffect(() => {
    if (link) {
      setText(`Dear parents, please complete your child's school record for ${school} using this link: ${link.url}\n\n` +
        'Fill in one form for each child. It takes about 3 minutes. The school will take the photos at school. Thank you.');
    }
  }, [link?.url, school]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['record-shared-link'] });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); await refresh(); showToast.success(ok); } catch (e) { showToast.error(recordsError(e)); } finally { setBusy(false); }
  };
  const copy = async (value: string, what: string) => {
    try { await navigator.clipboard.writeText(value); showToast.success(`${what} copied`); } catch { showToast.error('Could not copy. Select the text and copy it by hand.'); }
  };
  const printQr = async () => {
    if (!link) return;
    // Open the tab inside the click so the browser does not block it while the code is made.
    const w = window.open('', '_blank');
    if (!w) { showToast.error('Allow pop-ups for this site to print the QR code'); return; }
    w.document.write('<title>Preparing</title><p style="font:16px system-ui;padding:24px">Preparing the QR code…</p>');
    const qr = await QRCode.toDataURL(link.url, { width: 420, margin: 1, errorCorrectionLevel: 'M' });
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Complete your child's record</title><style>
      @page{margin:15mm}body{font-family:system-ui,Arial,sans-serif;text-align:center;padding-top:20mm}
      h1{font-size:30px;margin:0 0 6px}p{font-size:18px;color:#334155}img{width:110mm;height:110mm;margin:12mm 0}</style></head><body>
      <p style="font-weight:700">${escHtml(school)}</p><h1>Complete your child's school record</h1><img src="${qr}" alt=""/>
      <p>Scan with your phone camera, then fill in one form for each child.</p></body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };
  const copyIncomplete = async () => {
    try {
      const r = await studentRecordsService.list({ class_id: classId || undefined, filter: 'incomplete', limit: 200, page: 1 });
      const d = r.data;
      if (!d || !d.items.length) { showToast.info('Nobody is incomplete here'); return; }
      const byClass = new Map<string, string[]>();
      d.items.forEach((x) => { const k = x.class_name || 'No class'; byClass.set(k, [...(byClass.get(k) || []), x.name]); });
      const lines = [...byClass.entries()].map(([k, names]) => `${k}: ${names.join(', ')}`).join('\n');
      const more = d.total > d.items.length ? `\n…and ${d.total - d.items.length} more` : '';
      await navigator.clipboard.writeText(`Parents of these children have not yet completed the school record. Please use the link above:\n\n${lines}${more}`);
      showToast.success('List copied. Paste it in the group.');
    } catch (e) { showToast.error(recordsError(e, 'Could not copy the list')); }
  };

  return (
    <section aria-label="School link" className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
      <div className="flex items-start gap-3">
        <MessageCircle size={22} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-emerald-700" />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900 dark:text-white">One link for all parents</h2>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Post it once in the parents' WhatsApp group. Each parent writes their child's name and class and fills in the form.
            You check each one under "To review" before the record changes.
          </p>
        </div>
      </div>
      {q.isLoading ? null : !link ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">Link works for
            <select value={expiry} onChange={(e) => setExpiry(Number(e.target.value))} className={SELECT} aria-label="How long the link works">
              <option value={0}>Until I close it</option><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option>
            </select>
          </label>
          <Button disabled={busy} onClick={() => run(() => studentRecordsService.createSharedLink(expiry || undefined), 'Link created')} className="bg-emerald-700 text-white hover:bg-emerald-800">
            Create the school link
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input readOnly aria-label="School link" value={link.url} onFocus={(e) => e.currentTarget.select()} className={`${SELECT} min-w-[14rem] flex-1 font-mono text-xs`} />
            <Button variant="outline" onClick={() => copy(link.url, 'Link')}><Copy size={14} className="mr-1" /> Copy link</Button>
          </div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">Message for the group (you can edit it)
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={`${SELECT} mt-1 w-full text-sm font-normal`} />
          </label>
          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-700">
              <MessageCircle size={16} /> Share on WhatsApp
            </a>
            <Button variant="outline" onClick={() => copy(text, 'Message')}><Copy size={14} className="mr-1" /> Copy message</Button>
            <Button variant="outline" onClick={printQr}><Printer size={14} className="mr-1" /> Print QR</Button>
            <Button variant="outline" onClick={copyIncomplete}><UserCheck size={14} className="mr-1" /> Copy names still incomplete</Button>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {link.expires_at ? `Works until ${fmtDate(link.expires_at)}.` : 'Works until you close it.'} Created {fmtDate(link.created_at)}.{' '}
            <button type="button" disabled={busy} className="font-semibold text-emerald-800 underline"
              onClick={() => { if (window.confirm('Make a new link? The old link stops working.')) void run(() => studentRecordsService.createSharedLink(expiry || undefined), 'New link created'); }}>Make a new link</button>
            {' · '}
            <button type="button" disabled={busy} className="font-semibold text-red-700 underline"
              onClick={() => { if (window.confirm('Close the link? Parents will no longer be able to submit forms.')) void run(() => studentRecordsService.closeSharedLink(), 'Link closed'); }}>Close the link</button>
          </p>
        </div>
      )}
    </section>
  );
};
export default SharedLinkCard;
