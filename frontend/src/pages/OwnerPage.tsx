/**
 * OwnerPage: the school owner's overview. Plan and usage, fee-payment setup,
 * school verification, who runs the school, and recent sensitive changes.
 * Only the school owner sees it; the server enforces that too.
 */
import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Crown, CreditCard, Wallet, ShieldCheck, Users, History, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import useAuthStore from '@store/authStore';
import ownerService, { OwnerOverview } from '@services/ownerService';

const ACTION_LABEL: Record<string, string> = {
  'payment_settings.update': 'Changed the school payment settings',
  'payment_settings.disable': 'Turned off online fee payments',
  'payment_settings.stepup_failed': 'Wrong password while changing payment settings',
  'ownership.grant': 'Named a school owner',
  'ownership.revoke': 'Removed a school owner',
};

const PLAN_NAME: Record<string, string> = { freetong: 'Freetong', combra: 'Combra', bintumani: 'Bintumani' };

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const Card: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode; to?: string; linkLabel?: string }> = ({ icon, title, children, to, linkLabel }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 flex flex-col">
    <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">{icon}{title}</h2>
    <div className="mt-3 flex-1 text-sm text-gray-700 space-y-2">{children}</div>
    {to && (
      <Link to={to} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#1d4ed8] hover:text-[#1e40af]">
        {linkLabel || 'Open'} <ArrowRight size={14} aria-hidden="true" />
      </Link>
    )}
  </section>
);

const Meter: React.FC<{ label: string; current: number; max: number }> = ({ label, current, max }) => {
  const unlimited = !max || max >= 1_000_000;
  const pct = unlimited ? 0 : Math.min(100, Math.round((current / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span>{current}{unlimited ? '' : ` / ${max}`}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-gray-100" role="progressbar" aria-label={label} aria-valuenow={current} aria-valuemin={0} aria-valuemax={unlimited ? undefined : max}>
        <div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : 'bg-[#1d4ed8]'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export const OwnerPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<OwnerOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    ownerService.getOverview().then((res: any) => {
      if (cancelled) return;
      if (res?.success && res.data) setData(res.data);
      else setError(res?.error || 'Could not load the owner overview.');
    });
    return () => { cancelled = true; };
  }, []);

  // Principals who are not the owner never see this page.
  if ((user as any)?.isOwner === false) return <Navigate to="/dashboard" replace />;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl font-bold text-gray-900">
          <Crown size={22} className="text-amber-500" aria-hidden="true" /> School Owner
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {data?.schoolName ? `${data.schoolName}: ` : ''}the items only you can see and change.
        </p>
      </header>

      {!data && !error && (
        <div className="py-16 flex justify-center text-gray-400" role="status" aria-label="Loading">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex gap-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" /> {error}
        </div>
      )}

      {data && (
        <>
          {!data.hasNamedOwner && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900">
              No owner is named yet, so every principal can manage these items. Name the owner in{' '}
              <Link to="/settings?tab=owners" className="font-semibold underline">School Owners</Link>.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card icon={<CreditCard size={16} className="text-[#1d4ed8]" />} title="Plan & billing" to="/settings?tab=billing" linkLabel="Manage plan">
              {data.plan ? (
                <>
                  <p>
                    <strong>{PLAN_NAME[data.plan.planType] || data.plan.planType}</strong>
                    {data.plan.isTrial ? ' (trial)' : data.plan.isComp ? ' (complimentary)' : ''} ·{' '}
                    <span className={data.plan.status === 'active' ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{data.plan.status}</span>
                  </p>
                  {data.plan.endsAt && <p className="text-xs text-gray-500">Runs until {fmtDate(data.plan.endsAt)}</p>}
                </>
              ) : <p className="text-gray-500">Plan details are not available right now.</p>}
              {data.usage.students && <Meter label="Students" current={data.usage.students.current} max={data.usage.students.max} />}
              {data.usage.staff && <Meter label="Staff" current={data.usage.staff.current} max={data.usage.staff.max} />}
            </Card>

            <Card icon={<Wallet size={16} className="text-emerald-600" />} title="Fee payments" to="/settings?tab=payments" linkLabel="Payment settings">
              {data.payments.feeCollectionConfigured ? (
                <p className="text-emerald-700 font-semibold">Online fee payments are on. Fees settle into your school's Monime account.</p>
              ) : (
                <p className="text-gray-600">Online fee payments are off. Connect your school's Monime account so parents can pay online.</p>
              )}
            </Card>

            <Card
              icon={<ShieldCheck size={16} className="text-indigo-600" />}
              title="School verification"
              to={data.verification.status === 'verified' ? undefined : '/verify-school'}
              linkLabel="Verify your school"
            >
              {data.verification.status === 'verified' ? (
                <p className="text-emerald-700 font-semibold">Verified{data.verification.verifiedAt ? ` on ${fmtDate(data.verification.verifiedAt)}` : ''}.</p>
              ) : (
                <p className="text-gray-600">Not verified yet. It takes about two minutes and is needed before you change your plan.</p>
              )}
            </Card>

            <Card icon={<Users size={16} className="text-sky-600" />} title="Who runs the school" to="/settings?tab=owners" linkLabel="Manage owners">
              <ul className="divide-y divide-gray-100">
                {data.people.principals.map((p) => (
                  <li key={p.id} className="py-1.5 flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">
                      {p.name}
                      <span className="block text-xs text-gray-400 truncate">{p.email}{p.status !== 'active' ? ` · ${p.status}` : ''}</span>
                    </span>
                    <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${p.isOwner ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-600'}`}>
                      {p.isOwner ? 'Owner' : 'Principal'}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500 pt-1">
                {data.people.counts.students} students · {data.people.counts.teachers} teachers · {data.people.counts.bursars} bursars · {data.people.counts.admissionsOfficers} admissions
              </p>
            </Card>
          </div>

          <Card icon={<History size={16} className="text-gray-600" />} title="Recent sensitive changes">
            {data.activity.length === 0 ? (
              <p className="text-gray-500">Nothing yet. Changes to payment settings and ownership will show here.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.activity.map((a) => (
                  <li key={a.id} className="py-1.5 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{ACTION_LABEL[a.action] || a.action}</span>
                    <span className="text-xs text-gray-500">by {a.by} · {fmtDateTime(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
};

export default OwnerPage;
