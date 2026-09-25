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

  // Refresh the access token once (mirrors the apiClient interceptor). Exports
  // use a raw fetch for the binary stream, so they don't go through axios and
  // must handle an expired access token themselves — otherwise a stale token
  // just fails the download with a 401.
  const refreshAccessToken = async (): Promise<string | null> => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;
    try {
      const resp = await fetch(`${API_CONFIG.baseURL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!resp.ok) return null;
      const body = await resp.json().catch(() => ({}));
      const accessToken = body.access_token || body.accessToken || body?.data?.accessToken;
      const newRefresh = body.refresh_token || body.refreshToken || body?.data?.refreshToken;
      if (accessToken) localStorage.setItem('accessToken', accessToken);
      if (newRefresh) localStorage.setItem('refreshToken', newRefresh);
      return accessToken || null;
    } catch {
      return null;
    }
  };

  const doExport = async (format: 'csv' | 'excel' | 'pdf') => {
    setBusy(format);
    setOpen(false);
    try {
      // Build the query from only the params that actually have a value —
      // spreading undefined into URLSearchParams would serialize the literal
      // string "undefined" (e.g. ?date=undefined), which the backend then tries
      // to use as a filter.
      const qs = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim() !== '' && String(v) !== 'undefined') {
          qs.set(k, String(v));
        }
      });
      qs.set('format', format);
      const url = `${API_CONFIG.baseURL}${endpoint}?${qs.toString()}`;

      const call = (tok: string | null) =>
        fetch(url, {
          headers: tok ? { Authorization: `Bearer ${tok}` } : undefined,
          credentials: 'include',
        });

      let token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      let res = await call(token);

      // Access token expired → refresh once and retry (same as axios does).
      if (res.status === 401) {
        const fresh = await refreshAccessToken();
        if (fresh) {
          res = await call(fresh);
        }
      }

      if (!res.ok) {
        // Surface the server's message when it sent JSON (e.g. a real error).
        let msg = `Export failed (${res.status})`;
        try {
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const j = await res.json();
            msg = j?.error || j?.message || msg;
          }
        } catch { /* keep default */ }
        if (res.status === 401) msg = 'Your session expired. Please sign in again and retry.';
        throw new Error(msg);
      }

      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.href = objUrl;
      link.download = `${filename}-${date}.${EXT[format]}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objUrl);
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
