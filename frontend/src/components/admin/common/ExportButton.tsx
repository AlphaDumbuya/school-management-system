/**
 * ExportButton — downloads server-generated exports (CSV / Excel / PDF) from a
 * tenant-scoped export endpoint.
 *
 * It fetches the endpoint with the auth token, reads the blob, and triggers a
 * browser download. A small dropdown lets the user pick the format.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Download, ChevronDown, Loader2 } from 'lucide-react';
import { API_CONFIG } from '@config/api.config';
import { showToast } from '@utils/toast';

export interface ExportButtonProps {
  /** Endpoint path, e.g. '/api/v1/finance/export'. */
  endpoint: string;
  /** Extra query params (e.g. { date, classId }). */
  params?: Record<string, string | undefined>;
  /** Base filename (server also sets one via Content-Disposition). */
  filename?: string;
  formats?: Array<'csv' | 'excel' | 'pdf'>;
  label?: string;
  className?: string;
}

const FORMAT_LABEL: Record<string, string> = { csv: 'CSV', excel: 'Excel', pdf: 'PDF' };
const EXT: Record<string, string> = { csv: 'csv', excel: 'xlsx', pdf: 'pdf' };

export const ExportButton: React.FC<ExportButtonProps> = ({
  endpoint,
  params = {},
  filename = 'export',
  formats = ['csv', 'excel', 'pdf'],
  label = 'Export',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const doExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setBusy(format);
    setOpen(false);
    try {
      const qs = new URLSearchParams({ ...params, format } as Record<string, string>);
      // Drop empty params
      Array.from(qs.entries()).forEach(([k, v]) => {
        if (!v) qs.delete(k);
      });
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const res = await fetch(`${API_CONFIG.baseURL}${endpoint}?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `${filename}-${date}.${EXT[format]}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast.error(err?.message || 'Could not export. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={!!busy}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown size={14} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
          {formats.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => doExport(f)}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {FORMAT_LABEL[f]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportButton;
