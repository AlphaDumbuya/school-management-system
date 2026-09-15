/**
 * VerifyReportCardPage — /verify-report-card/:hash
 *
 * PUBLIC (no login) page reached by scanning the QR code on a printed
 * report card. The QR encodes a verification hash + student/class/year
 * query params. This page calls the public endpoint, verifies the hash,
 * and displays the full report card in a clean, professional layout.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, ShieldAlert, Loader2, GraduationCap, Award,
  TrendingUp, Calendar, User, School, CheckCircle2,
} from 'lucide-react';
import { verifyReportCard } from '@services/reportCardVerifyService';

type School = {
  name?: string; short_name?: string; logo_url?: string;
  address?: string; motto?: string; phone?: string; email?: string; website?: string;
};

type Card = {
  student?: { name?: string; admission_no?: string; class_name?: string; class_level?: string;
    photo_url?: string; form_teacher_name?: string; pupil_age?: number; class_average_age?: number; number_in_form?: number; };
  academic_year?: string;
  subjects?: { subject_name?: string; terms?: Record<string, { test1?: number; test2?: number; mean?: number; rank?: number }>;
    yearly_mean?: number; yearly_rank?: number }[];
  yearly_summary?: { percentage?: number; position?: number; class_size?: number; outcome?: string; promotion_recommendation?: string; combined_score?: number; };
  term_summaries?: Record<string, { combined_score?: number; percentage?: number; position?: number; class_size?: number; conduct?: string; on_time?: number; late?: number; absent?: number; }>;
  meta?: { principal_comment?: string; promotion_status?: string; };
};

const TERMS = ['first_term', 'second_term', 'third_term'] as const;
const TERM_LABELS: Record<string, string> = { first_term: 'Term 1', second_term: 'Term 2', third_term: 'Term 3' };
const OUTCOME_LABEL: Record<string, string> = { promoted: 'Promoted', promoted_effort: 'Promoted (Needs Effort)', fail: 'To Repeat' };

const ordinal = (n?: number | null) => {
  if (n == null) return '—';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default function VerifyReportCardPage() {
  const { hash } = useParams<{ hash: string }>();
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string>('');

  useEffect(() => {
    const studentId = params.get('s') || '';
    const classId = params.get('c') || '';
    const academicYear = params.get('y') || '';

    if (!hash || !studentId || !academicYear) {
      setError('Missing verification parameters. Please scan the QR code on the report card.');
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await verifyReportCard(hash, studentId, classId, academicYear);
        if (res.success && res.data?.verified) {
          setSchool(res.data.school || {});
          setCard(res.data.report_card || {});
          setVerifiedAt(res.data.verified_at);
        } else {
          setError(res.data ? 'Verification failed.' : (res as any).error || 'Verification failed.');
        }
      } catch {
        setError('Could not connect to the verification server. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [hash, params]);

  const student = card?.student;
  const ys = card?.yearly_summary;
  const ts = card?.term_summaries || {};

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center text-gray-500">
          <Loader2 size={40} className="animate-spin mb-4" />
          <span className="text-base font-medium">Verifying report card…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600 mb-4">
            <ShieldAlert size={34} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Verification Failed</h1>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-6 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header / Verified Banner */}
        <div className="bg-white rounded-2xl shadow-lg border border-emerald-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-emerald-600 to-green-600 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-white" size={28} />
              <div>
                <h1 className="text-xl font-black text-white">Report Card Verified</h1>
                <p className="text-emerald-50 text-xs">Authentic — Digitally Verified</p>
              </div>
            </div>
            <div className="text-right text-emerald-50 text-xs">
              <div className="flex items-center gap-1 justify-end">
                <CheckCircle2 size={12} />
                <span>Verified {new Date(verifiedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
            </div>
          </div>

          {/* School branding */}
          {school && (
            <div className="px-6 py-4 flex items-center gap-4 border-b border-gray-100">
              {school.logo_url ? (
                <img src={school.logo_url} alt={school.name} className="w-14 h-14 rounded-xl object-contain border border-gray-200" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gray-900 text-white flex items-center justify-center font-bold text-lg">
                  {school.short_name?.[0] || <School size={20} />}
                </div>
              )}
              <div className="flex-1">
                <h2 className="font-extrabold text-gray-900 text-lg leading-tight">{school.name || 'School'}</h2>
                {school.address && <p className="text-xs text-gray-500">{school.address}</p>}
                {school.motto && <p className="text-xs italic text-gray-500">{school.motto}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Student Summary Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start gap-4">
            {student?.photo_url ? (
              <img src={student.photo_url} alt={student.name} className="w-20 h-20 rounded-xl object-cover border-2 border-emerald-200" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-emerald-50 flex items-center justify-center">
                <User className="text-emerald-600" size={32} />
              </div>
            )}
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div><span className="text-gray-500 font-medium">Name:</span> <span className="font-bold text-gray-900">{student?.name}</span></div>
              <div><span className="text-gray-500 font-medium">Admission No:</span> <span className="font-bold text-gray-900">{student?.admission_no}</span></div>
              <div><span className="text-gray-500 font-medium">Class/Form:</span> <span className="font-bold text-gray-900">{student?.class_name || '—'}</span></div>
              <div><span className="text-gray-500 font-medium">Level:</span> <span className="font-bold text-gray-900">{student?.class_level || '—'}</span></div>
              <div><span className="text-gray-500 font-medium">Academic Year:</span> <span className="font-bold text-gray-900">{card?.academic_year}</span></div>
              <div><span className="text-gray-500 font-medium">Class Size:</span> <span className="font-bold text-gray-900">{student?.number_in_form ?? '—'}</span></div>
            </div>
          </div>
        </div>

        {/* Yearly Summary Highlights */}
        {ys && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 text-center">
              <TrendingUp className="mx-auto text-blue-600 mb-2" size={24} />
              <div className="text-2xl font-black text-gray-900">{ys.percentage != null ? `${ys.percentage}%` : '—'}</div>
              <div className="text-xs text-gray-500 font-medium">Overall</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 text-center">
              <Award className="mx-auto text-amber-600 mb-2" size={24} />
              <div className="text-2xl font-black text-gray-900">{ordinal(ys.position)}<span className="text-sm text-gray-400">/{ys.class_size}</span></div>
              <div className="text-xs text-gray-500 font-medium">Position</div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 text-center">
              <GraduationCap className={`mx-auto mb-2 ${ys.outcome === 'fail' ? 'text-red-600' : 'text-emerald-600'}`} size={24} />
              <div className={`text-sm font-black ${ys.outcome === 'fail' ? 'text-red-600' : 'text-emerald-600'}`}>
                {OUTCOME_LABEL[ys.outcome] || ys.outcome || '—'}
              </div>
              <div className="text-xs text-gray-500 font-medium">Status</div>
            </div>
          </div>
        )}

        {/* Subject Results Table */}
        {card?.subjects && card.subjects.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="px-6 py-3 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 flex items-center gap-2"><Calendar size={18} /> Subject Results</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <th className="text-left px-4 py-2.5 font-semibold">Subject</th>
                    {TERMS.map((t) => (
                      <th key={t} className="text-center px-3 py-2.5 font-semibold" colSpan={3}>{TERM_LABELS[t]}</th>
                    ))}
                    <th className="text-center px-3 py-2.5 font-semibold bg-amber-50">Yearly</th>
                  </tr>
                  <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase">
                    <th></th>
                    {TERMS.map((t) => (
                      <React.Fragment key={t}>
                        <th className="px-2 py-1 font-medium">T1</th>
                        <th className="px-2 py-1 font-medium">T2</th>
                        <th className="px-2 py-1 font-medium">Mn</th>
                      </React.Fragment>
                    ))}
                    <th className="px-2 py-1 font-medium bg-amber-50">Mn/Rnk</th>
                  </tr>
                </thead>
                <tbody>
                  {card.subjects.map((s, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-semibold text-gray-900 text-left">{s.subject_name}</td>
                      {TERMS.map((t) => {
                        const ts = s.terms?.[t];
                        return (
                          <React.Fragment key={t}>
                            <td className="px-2 py-2 text-center text-gray-600">{ts?.test1 ?? '—'}</td>
                            <td className="px-2 py-2 text-center text-gray-600">{ts?.test2 ?? '—'}</td>
                            <td className="px-2 py-2 text-center font-bold text-gray-900">{ts?.mean != null ? ts.mean : '—'}</td>
                          </React.Fragment>
                        );
                      })}
                      <td className="px-2 py-2 text-center font-bold text-amber-700 bg-amber-50/50">
                        {s.yearly_mean != null ? s.yearly_mean : '—'}
                        <span className="block text-[10px] text-gray-400 font-normal">Rank {ordinal(s.yearly_rank)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Term Summaries */}
        {Object.keys(ts).length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Award size={18} /> Term Summaries</h3>
            <div className="grid grid-cols-3 gap-4">
              {TERMS.map((t) => {
                const s = ts[t];
                if (!s) return <div key={t} className="text-center text-gray-400 text-sm py-4">{TERM_LABELS[t]} — No data</div>;
                return (
                  <div key={t} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-2">{TERM_LABELS[t]}</div>
                    <div className="text-lg font-black text-gray-900">{s.percentage != null ? `${s.percentage}%` : '—'}</div>
                    <div className="text-xs text-gray-500">{ordinal(s.position)}/{s.class_size ?? '—'}</div>
                    <div className="text-xs text-gray-400 mt-1">Att: {s.on_time ?? 0}/{s.late ?? 0}/{s.absent ?? 0}</div>
                    {s.conduct && <div className="text-xs font-medium text-gray-600 mt-1">Conduct: {s.conduct}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Principal Comment + Promotion */}
        {(card?.meta?.principal_comment || ys?.promotion_recommendation) && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="font-bold text-gray-900 mb-3">Principal's Comments</h3>
            {card?.meta?.principal_comment && (
              <p className="text-sm text-gray-700 italic mb-3">{card.meta.principal_comment}</p>
            )}
            {card?.meta?.promotion_status || ys?.promotion_recommendation ? (
              <div className="text-sm">
                <span className="font-bold text-gray-700">Promotion: </span>
                <span className={`font-bold ${(card?.meta?.promotion_status || ys?.outcome) === 'fail' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {card?.meta?.promotion_status || ys?.promotion_recommendation || '—'}
                </span>
              </div>
            ) : null}
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 py-4">
          <p>This report card was verified via digital QR authentication.</p>
          <p className="mt-1">Verified at {new Date(verifiedAt).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })}</p>
        </div>
      </div>
    </div>
  );
}
