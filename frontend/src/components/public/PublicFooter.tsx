/**
 * PublicFooter — shared premium footer for all public/marketing pages.
 * Deep-navy background, accent line, brand + newsletter, link columns,
 * contact, social chips and legal row. See docs/THEME_GUIDE.md.
 */
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import apiClient from '@lib/apiClient';
import { showToast } from '@utils/toast';
import { PLATFORM_SUPPORT, platformSupportTel } from '@config/platform.config';

const DOT_PATTERN: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
  backgroundSize: '26px 26px',
};

export const PublicFooter: React.FC = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const subscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setState('error');
      setMessage('Please enter a valid email.');
      return;
    }
    setState('loading');
    try {
      const res = await apiClient.post<{ success: boolean; message?: string; alreadySubscribed?: boolean }>(
        '/api/newsletter/subscribe',
        { email: value }
      );
      console.log('[Newsletter] subscribe response:', res);
      if (res.success) {
        setState('done');
        const msg = res.message || "You're subscribed! Watch your inbox for updates.";
        setMessage(msg);
        setEmail('');
        // Toast so the confirmation is unmistakable even if the inline block is
        // below the fold.
        if (res.alreadySubscribed) showToast.info(msg);
        else showToast.success(msg);
      } else {
        setState('error');
        const msg = (res as any)?.error || 'Could not subscribe. Please try again.';
        setMessage(msg);
        showToast.error(msg);
      }
    } catch (err: any) {
      console.error('[Newsletter] subscribe failed:', err?.response?.data || err?.message || err);
      setState('error');
      const msg = err?.response?.data?.error || 'Could not subscribe. Please try again.';
      setMessage(msg);
      showToast.error(msg);
    }
  };

  return (
    <footer className="relative overflow-hidden bg-[#0f1b45] text-blue-100/70">
      {/* Subtle pattern + glow */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={DOT_PATTERN} />
      <div className="absolute -top-24 right-[-6%] w-[420px] h-[420px] rounded-full bg-[#1d4ed8]/20 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-24 left-[-6%] w-[360px] h-[360px] rounded-full bg-amber-400/10 blur-[120px] pointer-events-none" />

      {/* Top accent line */}
      <div className="h-1 w-full bg-gradient-to-r from-[#1d4ed8] via-[#f59e0b] to-[#1d4ed8]" />

      <div className="relative px-6 sm:px-10 py-14">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-8 gap-y-10">
          {/* Brand + newsletter */}
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="WiSkul" className="w-9 h-9 rounded-xl object-contain bg-white p-1" />
              <span className="font-black text-lg text-white">Wi<span className="text-amber-400">Skul</span></span>
            </div>
            <p className="text-blue-100/70 text-sm leading-relaxed max-w-xs">
              School management for Sierra Leone: academics, attendance, fees and
              communication in one platform, with each school's data kept separate.
            </p>
            {state === 'done' ? (
              <div className="mt-5 flex items-center gap-2 max-w-xs text-sm text-emerald-300 font-semibold">
                <Check size={16} /> {message}
              </div>
            ) : (
              <form onSubmit={subscribe} className="mt-5 max-w-xs">
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
                    placeholder="Your email for updates"
                    className="flex-1 bg-white/10 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white placeholder-blue-100/40 outline-none focus:border-amber-400/50 min-w-0"
                  />
                  <button
                    type="submit"
                    disabled={state === 'loading'}
                    aria-label="Subscribe to newsletter"
                    className="bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-60 text-white font-bold text-sm px-4 py-2.5 rounded-lg transition-colors flex-shrink-0"
                  >
                    {state === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  </button>
                </div>
                {state === 'error' && <p className="mt-2 text-xs text-red-300">{message}</p>}
                <p className="mt-2 text-[11px] text-blue-100/40">Get product news and tips. Unsubscribe anytime.</p>
              </form>
            )}
          </div>

          <div>
            <h5 className="text-white font-bold text-xs mb-4 uppercase tracking-wider">Product</h5>
            <ul className="space-y-2.5">
              {[['Features', '/features'], ['Pricing', '/pricing'], ['Why WiSkul', '/why'], ['Benefits', '/benefits']].map(([label, to]) => (
                <li key={label}><span onClick={() => navigate(to)} className="text-blue-100/70 text-sm hover:text-amber-400 cursor-pointer transition-colors">{label}</span></li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="text-white font-bold text-xs mb-4 uppercase tracking-wider">Company</h5>
            <ul className="space-y-2.5">
              {[['Contact', '/contact'], ['Register', '/register'], ['Sign In', '/login']].map(([label, to]) => (
                <li key={label}><span onClick={() => navigate(to)} className="text-blue-100/70 text-sm hover:text-amber-400 cursor-pointer transition-colors">{label}</span></li>
              ))}
            </ul>
          </div>

          <div>
            <h5 className="text-white font-bold text-xs mb-4 uppercase tracking-wider">Contact</h5>
            <ul className="space-y-2.5 text-sm text-blue-100/70">
              <li><a href={`mailto:${PLATFORM_SUPPORT.email}`} className="hover:text-amber-400 transition-colors">{PLATFORM_SUPPORT.email}</a></li>
              <li><a href={platformSupportTel()} className="hover:text-amber-400 transition-colors">{PLATFORM_SUPPORT.phone}</a></li>
              <li className="text-blue-100/50">{PLATFORM_SUPPORT.address}</li>
            </ul>
            <div className="flex items-center gap-2.5 mt-4">
              <a
                href="https://www.facebook.com/wiskulsl"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-blue-100/70 hover:text-white hover:bg-[#1877F2] hover:border-[#1877F2] transition-colors"
                aria-label="WiSkul on Facebook"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-blue-100/50 text-xs">© {new Date().getFullYear()} WiSkul. All rights reserved.</p>
          <div className="flex items-center gap-5 text-xs text-blue-100/50">
            <Link to="/privacy-policy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link>
            <Link to="/contact" className="hover:text-amber-400 transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
