/**
 * /demo/start?t=<token>&portal=<key> — the personal links in the demo email.
 * Exchanges the link for a session in the read-only demo school, remembers
 * the link on this device (to switch portals from the demo banner) and opens
 * that portal's dashboard.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { getDashboardPath } from '@hooks/useAuth';
import demoService from '@services/demoService';
import { demoPortal, demoToken } from '@lib/demo';

export const DemoStartPage: React.FC = () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('t') || '';
  const portal = demoPortal(params.get('portal'));
  const [error, setError] = useState<{ title: string; text: string } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token || !portal) {
      setError({ title: 'This demo link is incomplete', text: 'Open the link from your demo email again, or ask for a new one.' });
      return;
    }
    void (async () => {
      const res = await demoService.startSession(token, portal.key);
      const user = res?.data?.user;
      if (res?.success && user) {
        demoToken.set(token);
        // A full load so nothing from a previous session lingers.
        window.location.replace(getDashboardPath(user.role));
        return;
      }
      const code = (res as any)?.code || (res as any)?.error?.code;
      const msg = typeof res?.error === 'string' ? res.error : (res as any)?.error?.message;
      if (code === 'DEMO_LINK_EXPIRED' || /expired/i.test(String(msg))) demoToken.clear();
      setError({
        title: /expired/i.test(String(msg)) ? 'This demo link has expired' : 'We couldn’t open the demo',
        text: msg || 'Please try again, or ask for a new demo link.',
      });
    })();
  }, [token, portal]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#16235c] via-[#1a2b6b] to-[#20308a] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 text-center shadow-2xl">
        {error ? (
          <div role="alert">
            <AlertTriangle size={40} className="mx-auto text-amber-500" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-black text-slate-900">{error.title}</h1>
            <p className="mt-2 text-sm text-slate-600">{error.text}</p>
            <a href="/?demo=1" className="mt-6 inline-flex w-full justify-center rounded-lg bg-[#f59e0b] hover:bg-[#d97706] px-5 py-3 text-sm font-bold text-white">
              Get a new demo link
            </a>
          </div>
        ) : (
          <div role="status">
            <Loader2 size={40} className="mx-auto animate-spin text-[#1d4ed8]" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-black text-slate-900">Opening the demo{portal ? ` ${portal.portal} portal` : ''}…</h1>
            <p className="mt-2 text-sm text-slate-600">
              {portal ? `You're signing in as ${portal.person} at WiSkul Demo Academy. ` : ''}Everything is sample data and changes are switched off.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DemoStartPage;
