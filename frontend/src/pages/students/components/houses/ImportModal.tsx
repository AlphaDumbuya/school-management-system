/**
 * Import existing houses: for a school that already has students in houses
 * (last year's lists, or a paper list). A CSV with a student number column and a
 * house column. The "House lists" export has exactly those columns, so the easy
 * way is: export, fill in the House column, import.
 */
import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { ExportButton } from '@components/admin/common/ExportButton';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { houseService, type HouseImportResult } from '@services/houseService';

export interface ParsedRows { rows: { student_number: string; house: string }[]; error?: string }

/** Minimal CSV reader: quotes, commas / semicolons / tabs, BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const first = src.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const out: string[][] = [];
  let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((x) => x.trim() !== ''));
}

/** Find the student-number and house columns by their headings. */
export function readHouseRows(text: string): ParsedRows {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], error: 'The file needs a heading row and at least one student.' };
  const head = table[0].map((h) => h.trim().toLowerCase());
  const houseCol = head.findIndex((h) => /house/.test(h));
  let numCol = head.findIndex((h) => /(student|admission|reg|pupil).*(no|num|id)|^(no\.?|number|id)$/.test(h));
  if (houseCol < 0) return { rows: [], error: 'No "House" column found. Add a column headed House.' };
  if (numCol < 0) numCol = houseCol === 0 ? 1 : 0;
  return { rows: table.slice(1).map((r) => ({ student_number: (r[numCol] || '').trim(), house: (r[houseCol] || '').trim() })) };
}

export const ImportModal: React.FC<{ isOpen: boolean; onClose: () => void; onDone: () => void }> = ({ isOpen, onClose, onDone }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedRows | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [createMissing, setCreateMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HouseImportResult | null>(null);

  const reset = () => { setFileName(''); setParsed(null); setOverwrite(false); setCreateMissing(false); setResult(null); if (fileRef.current) fileRef.current.value = ''; };
  const close = () => { if (busy) return; if (result) onDone(); reset(); onClose(); };

  const onFile = async (f?: File | null) => {
    setResult(null);
    if (!f) { setParsed(null); setFileName(''); return; }
    setFileName(f.name);
    if (f.size > 5 * 1024 * 1024) { setParsed({ rows: [], error: 'The file is too large (5 MB at most).' }); return; }
    setParsed(readHouseRows(await f.text()));
  };

  const usable = parsed?.rows.filter((r) => r.student_number && r.house && !/^no house( yet)?$/i.test(r.house)).length ?? 0;
  const houseNames = Array.from(new Set((parsed?.rows || []).map((r) => r.house).filter((h) => h && !/^no house( yet)?$/i.test(h))));

  const run = async () => {
    if (!parsed || !usable) return;
    setBusy(true);
    try {
      const r = await houseService.importAssignments({ rows: parsed.rows, overwrite, create_missing: createMissing });
      if (r.success === false || !r.data) { showToast.error(r.error || 'The import failed'); return; }
      setResult(r.data);
      onDone();
    } finally { setBusy(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title="Import existing houses" size="lg"
      footer={result ? <Button onClick={close}>Done</Button> : (
        <div className="flex w-full justify-end gap-2">
          <Button variant="outline" onClick={close} disabled={busy}>Cancel</Button>
          <Button onClick={run} disabled={busy || !usable}>{busy ? 'Importing…' : `Import ${usable} student${usable === 1 ? '' : 's'}`}</Button>
        </div>
      )}>
      {result ? (
        <div className="space-y-3 text-sm" aria-live="polite">
          <p><strong>{result.assigned}</strong> student{result.assigned === 1 ? '' : 's'} put in their house.</p>
          <ul className="list-disc space-y-0.5 pl-5 text-gray-700 dark:text-gray-300">
            {result.unchanged > 0 && <li>{result.unchanged} already in that house.</li>}
            {result.skipped_has_house > 0 && <li>{result.skipped_has_house} already have a different house and were left alone (switch on "replace" to change them).</li>}
            {result.blank > 0 && <li>{result.blank} rows had no house and were ignored.</li>}
            {result.created_houses.length > 0 && <li>New houses added: {result.created_houses.join(', ')}. Check their colours under Houses &amp; rules.</li>}
          </ul>
          {result.problem_count > 0 && (
            <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {result.problem_count} row{result.problem_count === 1 ? '' : 's'} could not be used:
              <ul className="mt-1 list-disc pl-4">{result.problems.slice(0, 12).map((p) => <li key={`${p.row}-${p.student_number}`}>Line {p.row}{p.student_number ? ` (${p.student_number})` : ''}: {p.reason}</li>)}</ul>
              {result.problem_count > 12 && <p className="mt-1">…and {result.problem_count - 12} more.</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-gray-700 dark:text-gray-300">
            <li>Download your student list. It has a <strong>House</strong> column.</li>
            <li>Fill in each student's house (the house name exactly as in your school) and save it as CSV.</li>
            <li>Choose the file here and import.</li>
          </ol>
          <ExportButton endpoint="/api/v1/admissions/houses/export" formats={['csv']} filename="students_for_houses" label="Download student list (CSV)" />

          <div>
            <label htmlFor="house-import-file" className="mb-1 block font-semibold text-gray-800 dark:text-gray-200">Your filled-in CSV file</label>
            <input ref={fileRef} id="house-import-file" type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])}
              className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700 hover:file:bg-blue-100" />
            {fileName && !parsed?.error && <p className="mt-1 text-xs text-gray-500"><Upload size={12} className="mr-1 inline" aria-hidden="true" />{fileName}</p>}
          </div>

          {parsed?.error && <p role="alert" className="text-sm text-red-600">{parsed.error}</p>}
          {parsed && !parsed.error && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <p className="font-semibold text-gray-900 dark:text-white">{usable} student{usable === 1 ? '' : 's'} with a house in the file</p>
              <p className="text-xs text-gray-500">Houses named in the file: {houseNames.length ? houseNames.join(', ') : 'none'}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-2">
              <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span><span className="block font-semibold text-gray-900 dark:text-white">Add houses that don't exist yet</span><span className="block text-xs text-gray-500">Otherwise rows with an unknown house name are skipped and listed.</span></span>
            </label>
            <label className="flex cursor-pointer items-start gap-2">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span><span className="block font-semibold text-gray-900 dark:text-white">Replace the house of students who already have one</span><span className="block text-xs text-gray-500">Off by default: students who already have a house are left alone. Replacements are recorded in the history.</span></span>
            </label>
          </div>
        </div>
      )}
    </Modal>
  );
};
