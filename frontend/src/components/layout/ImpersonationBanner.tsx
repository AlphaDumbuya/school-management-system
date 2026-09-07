/**
 * ImpersonationBanner — persistent bar shown while a super admin is viewing a
 * school as support. Exit restores the original super admin session.
 */
import React from 'react';
import { ShieldAlert, LogOut } from 'lucide-react';

export const ImpersonationBanner: React.FC = () => {
  const raw = typeof window !== 'undefined' ? sessionStorage.getItem('wiskul.impersonation.active') : null;
  if (!raw) return null;

  let schoolName = 'this school';
  try { schoolName = JSON.parse(raw).schoolName || schoolName; } catch { /* ignore */ }

  const exit = () => {
    try {
      const originRaw = sessionStorage.getItem('wiskul.impersonation.origin');
      if (originRaw) {
        const origin = JSON.parse(originRaw);
        if (origin.accessToken) localStorage.setItem('accessToken', origin.accessToken);
        else localStorage.removeItem('accessToken');
        if (origin.user) localStorage.setItem('user', origin.user);
      }
    } finally {
      sessionStorage.removeItem('wiskul.impersonation.origin');
      sessionStorage.removeItem('wiskul.impersonation.active');
      window.location.href = '/platform/tenants';
    }
  };

  return (
    <div className="sticky top-0 z-[70] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 flex items-center justify-between gap-3 shadow">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <ShieldAlert size={16} />
        <span>Support mode — you are viewing <strong>{schoolName}</strong> as this school.</span>
      </div>
      <button onClick={exit} className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-lg px-3 py-1 text-sm font-bold">
        <LogOut size={14} /> Exit support mode
      </button>
    </div>
  );
};

export default ImpersonationBanner;
