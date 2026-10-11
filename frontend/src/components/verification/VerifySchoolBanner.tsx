/**
 * VerifySchoolBanner — dashboard reminder for the account owner (principal)
 * while the school isn't verified. Hides itself once verified.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight } from 'lucide-react';
import useAuthStore from '@store/authStore';
import verificationService, { isVerifiedUser } from '@services/verificationService';

export const VerifySchoolBanner: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = (user as any)?.role;
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (role !== 'principal' || isVerifiedUser(user)) return;
    verificationService.getStatus().then((res) => {
      if (res.success && res.data?.status !== 'verified') setShow(true);
    });
  }, [role, user]);
  if (!show) return null;
  return (
    <div role="status" className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <ShieldCheck className="text-[#1d4ed8] shrink-0 mt-0.5" size={20} aria-hidden="true" />
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-sm">Verify your school</p>
          <p className="text-xs text-slate-600 mt-0.5">
            Confirm your school's EMIS code and your ID as the account owner. It takes about two minutes,
            and you'll need it before changing your subscription plan.
          </p>
        </div>
      </div>
      <button
        onClick={() => navigate('/verify-school')}
        className="self-start sm:self-auto shrink-0 inline-flex items-center gap-1.5 bg-[#1d4ed8] hover:bg-[#1e40af] text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-colors"
      >
        Verify now <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  );
};

export default VerifySchoolBanner;
