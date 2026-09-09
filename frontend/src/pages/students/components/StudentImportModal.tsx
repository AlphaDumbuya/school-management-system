/**
 * StudentImportModal — bulk-import students from a CSV file.
 *
 * Flow: download template → choose CSV → import → show a summary
 * (imported / skipped / failed) with per-row error messages. On success it
 * refreshes the student list.
 */
import React, { useState, useRef } from 'react';
import { X, UploadCloud, Download, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { API_CONFIG } from '@config/api.config';
import { studentsService, StudentImportResult } from '@services/studentsService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported?: () => void;
}

export const StudentImportModal: React.FC<Props> = ({ isOpen, onClose, onImported }) => {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StudentImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const reset = () => {
    setFile(null);
    setResult(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    reset();
    onClose();
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const res = await fetch(`${API_CONFIG.baseURL}/api/v1/students/import/template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Could not download the template.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student_import_template.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      showToast.error(e?.message || 'Template download failed.');
    }
  };

  const runImport = async () => {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await studentsService.importStudents(file);
      if (res.success === false) {
        showToast.apiError((res as any).error || 'Import failed.');
        return;
      }
      const data = (res as any).data as StudentImportResult;
      setResult(data);
      if (data.imported > 0) {
        showToast.success(`Imported ${data.imported} student${data.imported === 1 ? '' : 's'}.`);
        onImported?.();
      } else {
        showToast.error('No students were imported. Check the errors below.');
      }
    } catch (e: any) {
      showToast.error(e?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Import Students</h3>
          <button onClick={close} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Upload a CSV to add many students at once. Not sure of the format? Download the template first.
              </p>

              <button
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                <Download size={16} /> Download CSV template
              </button>

              <label className="block border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 transition-colors">
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <UploadCloud size={28} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-700 dark:text-gray-200 font-medium">
                  {file ? file.name : 'Click to choose a CSV file'}
                </p>
                <p className="text-xs text-gray-400 mt-1">CSV up to 5MB, max 2000 rows</p>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={close}>Cancel</Button>
                <Button variant="default" size="sm" onClick={runImport} disabled={!file || busy}>
                  {busy ? <Loader2 size={15} className="animate-spin mr-1.5" /> : <UploadCloud size={15} className="mr-1.5" />}
                  {busy ? 'Importing…' : 'Import'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 text-center">
                  <div className="text-2xl font-black text-emerald-600">{result.imported}</div>
                  <div className="text-xs text-gray-500">Imported</div>
                </div>
                <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3 text-center">
                  <div className="text-2xl font-black text-amber-600">{result.skipped}</div>
                  <div className="text-xs text-gray-500">Skipped</div>
                </div>
                <div className="rounded-xl bg-red-50 dark:bg-red-500/10 p-3 text-center">
                  <div className="text-2xl font-black text-red-600">{result.failed}</div>
                  <div className="text-xs text-gray-500">Failed</div>
                </div>
              </div>

              {result.errors.length > 0 ? (
                <div className="rounded-xl border border-gray-100 dark:border-gray-700 max-h-52 overflow-y-auto">
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700/40 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    <AlertTriangle size={14} className="text-amber-500" /> Issues
                  </div>
                  <ul className="divide-y divide-gray-50 dark:divide-gray-800">
                    {result.errors.map((e, i) => (
                      <li key={i} className="px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
                        {e.row > 0 ? <span className="font-semibold">Row {e.row}: </span> : null}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle size={16} /> All rows imported cleanly.
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={reset}>Import another</Button>
                <Button variant="default" size="sm" onClick={close}>Done</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentImportModal;
