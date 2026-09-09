/**
 * VerifySchoolBanner — dashboard call-to-action shown to an UNVERIFIED account
 * owner (principal). Fetches status once; hides itself when verified or for
 * non-owners. Links to the verification flow.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import useAuthStore from '@store/authStore';
import verificationService from '@services/verificationService';

export const VerifySchoolBanner: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const role = (user as any)?.role;
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (role !== 'principal') return;
    // Trust the cached flag first; confirm with the server.
    if ((user as any)?.verification_status === 'verified') return;
    verificationService.getStatus().then((res) => {
      if (res.success && res.data?.status !== 'verified') setShow(true);
    });
  }, [role, user]);

  if (!show) return null;

  return (
    <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
      <ShieldAlert className="text-amber-600 shrink-0 mt-0.5" size={20} />
      <div className="flex-1">
        <p className="font-bold text-amber-900 text-sm">Verify your school</p>
        <p className="text-xs text-amber-800 mt-0.5">
          Verify to protect your account, build trust, and unlock high-impact features like
          billing, staff management, and ID card issuance.
        </p>
      </div>
      <button
        onClick={() => navigate('/verify-school')}
        className="shrink-0 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-colors"
      >
        Verify now <ArrowRight size={14} />
      </button>
    </div>
  );
};

export default VerifySchoolBanner;
