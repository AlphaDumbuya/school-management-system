/**
 * Ballot tab: the students still waiting for a house. Draw one at a time on
 * registration day (a lottery draw with the registered houses), or draw the
 * whole list at once. Filter by any number of classes, each filter with its
 * own search.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shuffle } from 'lucide-react';
import { Modal } from '@components/admin/feedback/Modal';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { SearchBar } from '@components/admin/table/SearchBar';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { houseService, type DrawManyResult, type DrawResult, type HouseStudent, type HouseSummary } from '@services/houseService';
import { HouseChip, METHOD_LABEL, unwrap } from './houseUi';
import { LotteryDraw, LotteryDrum, type LotteryHouse } from './LotteryDraw';
import { SearchableMultiSelect } from './SearchableMultiSelect';

type Reveal =
  | { state: 'drawing'; name: string }
  | { state: 'done'; name: string; result: DrawResult }
  | { state: 'error'; name: string; error: string };

/**
 * Manager mode (principal / admissions officer): every student and class, and "Draw for all".
 * Teacher mode (`teacher` given): only the permitted teacher's own classes, one student at a time.
 */
export const BallotTab: React.FC<{
  summary?: HouseSummary;
  onChanged: () => void;
  onGoHouses?: () => void;
  teacher?: { houses: LotteryHouse[] };
}> = ({ summary, onChanged, onGoHouses, teacher }) => {
  const queryClient = useQueryClient();
  const [classIds, setClassIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [drawId, setDrawId] = useState(0);
  const [settled, setSettled] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [busyAll, setBusyAll] = useState(false);
  const [allResult, setAllResult] = useState<DrawManyResult | null>(null);
  const busy = useRef(false);

  const activeHouses = (summary?.houses || []).filter((h) => h.is_active);
  const lotteryHouses: LotteryHouse[] = teacher ? teacher.houses : activeHouses.map((h) => ({ id: h.id, name: h.name, color: h.color, motto: h.motto }));

  const listQ = useQuery({
    queryKey: ['houses', teacher ? 'my-waiting' : 'waiting', classIds.join(','), search],
    queryFn: async () => (teacher
      ? unwrap(await houseService.myWaiting(search || undefined))
      : unwrap(await houseService.students({ house_id: 'none', class_ids: classIds.length ? classIds.join(',') : undefined, search: search || undefined, limit: 500 }))),
    staleTime: 15_000,
  });
  const waiting: HouseStudent[] = listQ.data || [];

  // Every class that has students (also those with nobody waiting), so any class can be picked.
  const classOptions = useMemo(
    () => (summary?.by_class || []).filter((c) => c.class_id).map((c) => ({
      value: c.class_id as string, label: c.class_name,
      hint: c.unassigned > 0 ? `${c.unassigned} waiting` : 'all done', muted: c.unassigned === 0,
    })),
    [summary],
  );

  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['houses'] }); onChanged(); };

  const drawOne = async (s: HouseStudent) => {
    if (busy.current) return;
    busy.current = true;
    const name = `${s.first_name} ${s.last_name}`.trim();
    setSettled(false);
    setDrawId((n) => n + 1);
    setReveal({ state: 'drawing', name });
    try {
      const res = await (teacher ? houseService.myDraw(s.id) : houseService.draw(s.id));
      if (res.success === false || !res.data) setReveal({ state: 'error', name, error: res.error || 'Could not draw a house.' });
      else setReveal({ state: 'done', name, result: res.data });
    } catch (e) {
      setReveal({ state: 'error', name, error: (e as Error).message });
    } finally {
      busy.current = false;
      refresh();
    }
  };

  const nextAfter = (id: string) => waiting.find((w) => w.id !== id);
  // How many students "Draw for all" will cover. The list shows at most 500, so with only a class filter
  // (no search) the count comes from the class totals and the server draws everyone who matches.
  const listIsComplete = waiting.length < 500;
  const totalWaiting = search || listIsComplete ? waiting.length
    : classIds.length ? (summary?.by_class || []).filter((c) => c.class_id && classIds.includes(c.class_id)).reduce((n, c) => n + c.unassigned, 0)
    : (summary?.unassigned ?? waiting.length);
  const drawAll = async () => {
    setBusyAll(true);
    try {
      const r = await houseService.drawMany(search || listIsComplete
        ? { student_ids: waiting.map((w) => w.id) }
        : { class_ids: classIds.length ? classIds.join(',') : undefined });
      if (r.success === false || !r.data) { showToast.error(r.error || 'Could not draw'); return; }
      setConfirmAll(false);
      setAllResult(r.data);
    } finally { setBusyAll(false); refresh(); }
  };

  if (!teacher && summary && activeHouses.length === 0 && onGoHouses) {
    return (
      <EmptyState message="Set up your houses first" description="Add the houses (for example Red, Blue, Green and Yellow) before you start the ballot."
        action={{ label: 'Set up houses', onClick: onGoHouses }} />
    );
  }

  // The house that was drawn must be on the screen even if it was switched off meanwhile.
  const screenHouses = reveal?.state === 'done' && !lotteryHouses.some((h) => h.id === reveal.result.house.id)
    ? [...lotteryHouses, reveal.result.house]
    : lotteryHouses;
  const canCloseReveal = !!reveal && reveal.state !== 'drawing';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className={`grid flex-1 grid-cols-1 gap-2 ${teacher ? '' : 'sm:grid-cols-[minmax(0,1fr)_260px]'}`}>
          <SearchBar placeholder="Search name or student number…" onSearch={setSearch} isLoading={listQ.isFetching} className="w-full" />
          {!teacher && (
            <SearchableMultiSelect id="ballot-classes" label="Classes" allLabel="All classes" noun="classes"
              options={classOptions} selected={classIds} onChange={setClassIds} />
          )}
        </div>
        {!teacher && (
          <Button onClick={() => setConfirmAll(true)} disabled={waiting.length === 0} className="whitespace-nowrap">
            <Shuffle size={15} className="mr-1.5" aria-hidden="true" /> Draw for all {waiting.length > 0 ? `(${totalWaiting})` : ''}
          </Button>
        )}
      </div>

      {listQ.error ? (
        <p role="alert" className="text-sm text-red-600">{(listQ.error as Error).message} <button type="button" className="font-bold underline" onClick={() => listQ.refetch()}>Retry</button></p>
      ) : listQ.isLoading ? (
        <p className="text-sm text-gray-500">Loading students…</p>
      ) : waiting.length === 0 ? (
        <EmptyState message={search || classIds.length ? 'Nobody matches these filters' : teacher ? 'Every student in your classes has a house' : 'Every student has a house'}
          description={search || classIds.length ? 'Clear the search or the class filter.' : 'New students will show up here after they are enrolled.'} />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
          {waiting.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{s.first_name} {s.last_name}</p>
                <p className="truncate text-xs text-gray-500">{s.student_number}{s.class_name ? ` · ${s.class_name}` : ''}{s.gender ? ` · ${s.gender}` : ''}</p>
              </div>
              <Button size="sm" className="flex-shrink-0" onClick={() => drawOne(s)} aria-label={`Draw a house for ${s.first_name} ${s.last_name}`}>
                <Shuffle size={14} className="mr-1" aria-hidden="true" /> Draw
              </Button>
            </li>
          ))}
        </ul>
      )}
      {waiting.length >= 500 && <p className="text-xs text-gray-500">Showing the first 500 of {totalWaiting}. "Draw for all" covers everyone who matches (up to 1,000 at a time).</p>}

      {/* One student: the lottery */}
      <Modal isOpen={!!reveal} onClose={() => { if (canCloseReveal) setReveal(null); }} title="House draw" size="lg"
        footer={reveal && (reveal.state === 'error' || settled) ? (
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setReveal(null)}>Done</Button>
            {reveal.state === 'done' && nextAfter(reveal.result.student.id) && (
              <Button onClick={() => { const n = nextAfter(reveal.result.student.id); if (n) drawOne(n); }}>Draw next student</Button>
            )}
          </div>
        ) : undefined}>
        {reveal && reveal.state !== 'error' && (
          <LotteryDraw key={drawId} houses={screenHouses} winnerId={reveal.state === 'done' ? reveal.result.house.id : null}
            studentName={reveal.name} photoUrl={reveal.state === 'done' ? reveal.result.student.photo_url : null} method={reveal.state === 'done' ? reveal.result.method : undefined} onSettled={() => setSettled(true)} />
        )}
        {reveal?.state === 'error' && <p role="alert" className="text-sm text-red-600">{reveal.error}</p>}
      </Modal>

      {/* Everyone on the list */}
      <Modal isOpen={confirmAll} onClose={() => !busyAll && setConfirmAll(false)} title="Draw for everyone listed?" size="sm"
        footer={<div className="flex w-full justify-end gap-2"><Button variant="outline" onClick={() => setConfirmAll(false)} disabled={busyAll}>Cancel</Button><Button onClick={drawAll} disabled={busyAll}>{busyAll ? 'Drawing…' : `Draw ${Math.min(totalWaiting, 1000)} student${totalWaiting === 1 ? '' : 's'}`}</Button></div>}>
        {busyAll ? (
          <div className="py-2"><LotteryDrum houses={lotteryHouses} /><p className="mt-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300" role="status">Drawing houses…</p></div>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Each of the {Math.min(totalWaiting, 1000)} student{totalWaiting === 1 ? '' : 's'} listed gets a house, drawn at random in a mixed order. The draw always fills the smallest houses, so the houses end up level (within one student), and your ballot rules mix boys, girls and classes. A student's house can only be changed afterwards by staff, with a reason.
          </p>
        )}
      </Modal>

      <Modal isOpen={!!allResult} onClose={() => setAllResult(null)} title="Ballot finished" size="md" footer={<Button onClick={() => setAllResult(null)}>Done</Button>}>
        {allResult && (
          <div className="space-y-3 text-sm">
            <p><strong>{allResult.drawn}</strong> student{allResult.drawn === 1 ? '' : 's'} got a house.</p>
            {allResult.more && <p className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">More students are still waiting. Press "Draw for all" again for the next batch.</p>}
            <div className="flex flex-wrap gap-2">
              {Object.values(allResult.results.reduce((acc: Record<string, { n: number; r: DrawResult['house'] }>, r) => {
                acc[r.house.id] = { n: (acc[r.house.id]?.n || 0) + 1, r: r.house }; return acc;
              }, {})).map(({ n, r }) => (
                <span key={r.id} className="inline-flex items-center gap-1.5"><HouseChip name={r.name} color={r.color} /> <span className="font-bold">{n}</span></span>
              ))}
            </div>
            {allResult.results.some((r) => r.method === 'sibling') && (
              <p className="text-xs text-gray-500">{allResult.results.filter((r) => r.method === 'sibling').length} joined a brother or sister ({METHOD_LABEL.sibling.toLowerCase()}).</p>
            )}
            {allResult.failed.length > 0 && (
              <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                {allResult.failed.length} could not be drawn:
                <ul className="mt-1 list-disc pl-4">{allResult.failed.slice(0, 5).map((f) => <li key={f.student_id}>{f.error}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
