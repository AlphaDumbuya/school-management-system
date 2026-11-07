/**
 * WelcomeEditor: the message parents read before the form. The school can keep the default or write its own.
 * {school} is replaced by the school's name when parents see it. Blank lines separate paragraphs.
 */
import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@components/ui/button';
import { studentRecordsService, recordsError } from '@services/studentRecordsService';
import { showToast } from '@utils/toast';

export const WelcomeEditor: React.FC = () => {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['record-welcome'], queryFn: () => studentRecordsService.getWelcome() });
  const data = q.data?.data;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setText(data.message); }, [data?.message]);

  const save = async (message: string, ok: string) => {
    setBusy(true);
    try {
      await studentRecordsService.setWelcome(message);
      await qc.invalidateQueries({ queryKey: ['record-welcome'] });
      showToast.success(ok);
    } catch (e) { showToast.error(recordsError(e, 'Could not save the message')); } finally { setBusy(false); }
  };

  return (
    <details className="mb-4 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <summary className="cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-100">
        Message parents read first {data?.is_custom ? '(your own wording)' : '(standard wording)'}
      </summary>
      <p className="mt-2 text-xs text-gray-500">
        Parents see this before the form: why the school is moving to a digital system and why they should update their child's details.
        Write <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">{'{school}'}</code> where the school's name should appear. Leave a blank line between paragraphs.
      </p>
      <textarea aria-label="Message for parents" value={text} onChange={(e) => setText(e.target.value)} rows={12} maxLength={3000}
        className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button disabled={busy || !text.trim() || text === data?.message} onClick={() => save(text, 'Message saved')} className="bg-primary-700 text-white hover:bg-primary-800">Save message</Button>
        <Button variant="outline" disabled={busy || !data?.is_custom} onClick={() => save('', 'Standard wording restored')}>Use the standard wording</Button>
      </div>
    </details>
  );
};
export default WelcomeEditor;
