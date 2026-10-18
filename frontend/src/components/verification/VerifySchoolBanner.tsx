/**
 * VerifySchoolBanner — dashboard notice for the account owner (principal)
 * while the school isn't verified:
 *   unverified → invite to submit · pending → under review (info only) ·
 *   rejected → not approved, see why and resubmit. Hidden once verified.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Clock, AlertTriangle } from 'lucide-react';
import useAuthStore from '@store/authStore';
import verificationService, { isVerifiedUser, type VerificationState } from '@services/verificationService';

export const VerifySchoolBanner: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = (user as any)?.role;
  const [state, setState] = useState<VerificationState | null>(null);
  useEffect(() => {
    if (role !== 'principal' || (user as any)?.isOwner === false || isVerifiedUser(user)) {
      setState(null);
      return;
    }
    let cancelled = false;
    verificationService.getStatus().then((res) => {
      if (!cancelled && res.success && res.data) setState(res.data.status);
    });
    return () => { cancelled = true; };
  }, [role, user]);

  if (!state || state === 'verified') return null;

  if (state === 'pending') {
    return (
      <div role="status" className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <Clock className="text-[#1d4ed8] shrink-0 mt-0.5" size={20} aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-sm">Verification under review</p>
          <p className="text-xs text-slate-600 mt-0.5">
            WiSkul is reviewing your school's details, usually within one working day. We'll let you know by email and in the app.
          </p>
        </div>
      </div>
    );
  }

  const rejected = state === 'rejected';
  return (
    <div role="status" className={`mb-4 rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${rejected ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {rejected
          ? <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={20} aria-hidden="true" />
          : <ShieldCheck className="text-[#1d4ed8] shrink-0 mt-0.5" size={20} aria-hidden="true" />}
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-sm">{rejected ? 'Verification not approved' : 'Verify your school'}</p>
          <p className="text-xs text-slate-600 mt-0.5">
            {rejected
              ? "WiSkul couldn't approve your school's details. See why, fix them and submit again."
              : "Submit your school's EMIS code and your ID as the account owner, and WiSkul reviews them. You'll need a verified school before changing your subscription plan."}
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate('/verify-school')}
        className={`self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-colors ${rejected ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1d4ed8] hover:bg-[#1e40af]'}`}
      >
        {rejected ? 'See why and resubmit' : 'Verify now'} <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
};

export default VerifySchoolBanner;
