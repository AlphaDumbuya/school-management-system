/**
 * "Try the live demo": one card per portal. Each signs in to WiSkul Demo
 * Academy (sample data, read-only) through /login?demo=<portal>.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, GraduationCap, Users, User, Wallet, ClipboardList, PlayCircle } from 'lucide-react';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@lib/demo';

const ICONS: Record<string, React.ElementType> = {
  principal: Briefcase, teacher: Users, student: GraduationCap, parent: User, bursar: Wallet, admissions: ClipboardList,
};

export const LiveDemoSection: React.FC = () => {
  const navigate = useNavigate();
  return (
    <section id="demo" aria-labelledby="demo-title" className="px-6 sm:px-10 py-20 sm:py-24 bg-white border-y border-[#e5e9f2]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-bold tracking-[0.2em] uppercase mb-2 text-[#1d4ed8]">Live demo</p>
          <h2 id="demo-title" className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">See WiSkul with a real school</h2>
          <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto mt-4" />
          <p className="text-sm sm:text-base mt-4 text-slate-500">
            Step into WiSkul Demo Academy: 72 students, 6 classes, a full term of attendance, results, fees,
            payroll and admissions. Pick a portal and you're in. No sign-up needed.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {DEMO_ACCOUNTS.map((a) => {
            const Icon = ICONS[a.key] || PlayCircle;
            return (
              <button
                key={a.key}
                type="button"
                onClick={() => navigate(`/login?demo=${a.key}`)}
                className="group text-left bg-[#f8faff] border border-[#e5e9f2] rounded-2xl p-6 hover:border-blue-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-11 h-11 rounded-xl bg-[#1a2b6b] text-white flex items-center justify-center shrink-0">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{a.portal} portal</p>
                    <p className="text-xs text-slate-500 truncate">{a.person}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-2">{a.blurb}</p>
                <p className="text-[11px] font-mono text-slate-400 mb-4 truncate">{a.identifier}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#1d4ed8]">
                  Open the {a.portal.toLowerCase()} portal <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-center text-xs text-slate-500 mt-8">
          Sample data only, and changes are switched off. To sign in by hand (also in the Android app), use the
          sign-in on a card with the password <span className="font-mono font-semibold text-slate-700">{DEMO_PASSWORD}</span>.
        </p>
      </div>
    </section>
  );
};

export default LiveDemoSection;
