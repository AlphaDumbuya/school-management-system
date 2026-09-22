/**
 * ContactPage — /contact
 * Light edu-SaaS theme (see docs/THEME_GUIDE.md). Shared navbar + footer.
 * Contact form posts to /api/contact (Brevo).
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Phone, MapPin, ArrowRight, Check, X, Loader2, Clock } from 'lucide-react';
import PublicNavbar, { PublicFooter } from '@components/public';

const NAVY_BAND = 'bg-gradient-to-br from-[#16235c] via-[#1a2b6b] to-[#20308a]';
const DOT_PATTERN: React.CSSProperties = {
  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
  backgroundSize: '26px 26px',
};

const contactSchema = z.object({
  name: z.string().min(1, 'Full name is required').max(100, 'Max 100 characters'),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  phone: z.string().optional().or(z.literal('')),
  school: z.string().optional().or(z.literal('')),
  role: z.string().min(1, 'Please select your role'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000, 'Max 2000 characters'),
});
type ContactFormValues = z.infer<typeof contactSchema>;

const inputBase =
  'w-full bg-white border rounded-xl px-4 py-3.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-colors';

export const ContactPage: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', phone: '', school: '', role: '', message: '' },
  });

  const onSubmit = async (data: ContactFormValues) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (response.ok) {
        setSubmitStatus('success');
        reset();
      } else {
        const resData = await response.json().catch(() => ({}));
        throw new Error(resData.message || 'Failed to send message');
      }
    } catch (error: any) {
      setSubmitStatus('error');
      setErrorMessage(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const err = (field: keyof ContactFormValues) =>
    errors[field] ? 'border-red-400 focus:border-red-500' : 'border-[#e5e9f2] focus:border-[#1d4ed8]';

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-700 overflow-x-hidden font-sans antialiased">
      <PublicNavbar ctaText="Register School Free" />

      {/* ═══ HERO (navy) ═══ */}
      <section className={`relative pt-28 sm:pt-36 pb-16 px-6 sm:px-10 overflow-hidden ${NAVY_BAND}`}>
        <div className="absolute inset-0 opacity-[0.12] pointer-events-none" style={DOT_PATTERN} />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-5 py-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-white/90 text-xs font-bold tracking-widest uppercase">We're here to help</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black leading-[1.1] mb-5 text-white">
            Get in touch with <span className="text-amber-400">WiSkul</span>
          </h1>
          <p className="text-blue-100/90 text-base max-w-2xl mx-auto leading-relaxed">
            Questions about the platform? Want a demo or help getting set up? Our team is ready to assist.
          </p>
        </div>
      </section>

      {/* ═══ FORM + INFO (light, overlapping) ═══ */}
      <section className="px-6 sm:px-10 -mt-8 relative z-20 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Info column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-[#e5e9f2] rounded-2xl p-7 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-6">Contact information</h3>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1d4ed8] flex items-center justify-center flex-shrink-0"><Mail size={18} /></div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 mb-1.5 uppercase tracking-wider">Email</p>
                    <p className="text-sm"><a href="mailto:info@wiskulsl.com" className="text-slate-800 hover:text-[#1d4ed8] font-medium">info@wiskulsl.com</a><span className="text-slate-400 text-xs block">General enquiries</span></p>
                    <p className="text-sm mt-1.5"><a href="mailto:support@wiskulsl.com" className="text-slate-800 hover:text-[#1d4ed8] font-medium">support@wiskulsl.com</a><span className="text-slate-400 text-xs block">Technical support</span></p>
                    <p className="text-sm mt-1.5"><a href="mailto:sales@wiskulsl.com" className="text-slate-800 hover:text-[#1d4ed8] font-medium">sales@wiskulsl.com</a><span className="text-slate-400 text-xs block">Sales & demos</span></p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0"><Phone size={18} /></div>
                  <div><p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Phone</p><p className="text-slate-800 text-sm font-medium">+232 34 330 610</p><p className="text-slate-400 text-xs">Mon–Fri, 9AM – 5PM</p></div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0"><MapPin size={18} /></div>
                  <div><p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Office</p><p className="text-slate-800 text-sm font-medium">Kossoh Town</p><p className="text-slate-400 text-xs">Sierra Leone</p></div>
                </div>
              </div>
            </div>

            <div className={`relative overflow-hidden rounded-2xl p-6 text-center ${NAVY_BAND}`}>
              <div className="absolute inset-0 opacity-[0.1]" style={DOT_PATTERN} />
              <div className="relative">
                <div className="w-11 h-11 mx-auto rounded-xl bg-amber-500 text-white flex items-center justify-center mb-3"><Clock size={20} /></div>
                <p className="text-2xl font-black text-white mb-1">&lt; 24 hours</p>
                <p className="text-sm text-blue-100/80">Average response time</p>
              </div>
            </div>
          </div>

          {/* Form column */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-[#e5e9f2] rounded-2xl p-7 sm:p-9 shadow-sm">
              <h3 className="text-xl font-black text-slate-900 mb-6">Send us a message</h3>

              {submitStatus === 'success' && (
                <div className="mb-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0"><Check size={13} strokeWidth={3} /></span>
                  <div><p className="text-emerald-700 font-bold text-sm mb-0.5">Message sent!</p><p className="text-slate-500 text-xs">Thanks for reaching out — we'll reply within 24 hours.</p></div>
                </div>
              )}
              {submitStatus === 'error' && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0"><X size={13} strokeWidth={3} /></span>
                  <div><p className="text-red-700 font-bold text-sm mb-0.5">Something went wrong</p><p className="text-slate-500 text-xs">{errorMessage}</p></div>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Full Name *</label>
                    <input type="text" {...register('name')} placeholder="John Doe" className={`${inputBase} ${err('name')}`} />
                    {errors.name && <p className="mt-1.5 text-xs text-red-500">{errors.name.message}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Email Address *</label>
                    <input type="email" {...register('email')} placeholder="john@school.com" className={`${inputBase} ${err('email')}`} />
                    {errors.email && <p className="mt-1.5 text-xs text-red-500">{errors.email.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Phone Number</label>
                    <input type="tel" {...register('phone')} placeholder="+232 76 123 456" className={`${inputBase} ${err('phone')}`} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">School Name</label>
                    <input type="text" {...register('school')} placeholder="ABC International School" className={`${inputBase} ${err('school')}`} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Your Role *</label>
                  <select {...register('role')} className={`${inputBase} ${err('role')} cursor-pointer`}>
                    <option value="">Select your role</option>
                    <option value="principal">Principal</option>
                    <option value="admin">School Administrator</option>
                    <option value="teacher">Teacher</option>
                    <option value="parent">Parent</option>
                    <option value="owner">School Owner</option>
                    <option value="other">Other</option>
                  </select>
                  {errors.role && <p className="mt-1.5 text-xs text-red-500">{errors.role.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-600 mb-2">Message *</label>
                  <textarea {...register('message')} rows={5} placeholder="Tell us how we can help you…" className={`${inputBase} ${err('message')} resize-none`} />
                  {errors.message && <p className="mt-1.5 text-xs text-red-500">{errors.message.message}</p>}
                </div>
                <button type="submit" disabled={isSubmitting}
                  className="w-full bg-[#f59e0b] hover:bg-[#d97706] text-white font-bold text-sm py-4 rounded-xl transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] flex items-center justify-center gap-2">
                  {isSubmitting ? (<><Loader2 size={16} className="animate-spin" /> Sending…</>) : (<>Send Message <ArrowRight size={16} /></>)}
                </button>
                <p className="text-xs text-slate-400 text-center">By submitting, you agree to our Privacy Policy and Terms of Service.</p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ (white) ═══ */}
      <section className="px-6 sm:px-10 py-20 bg-white border-y border-[#e5e9f2]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">Frequently asked questions</h2>
            <div className="w-12 h-1 bg-[#f59e0b] rounded-full mx-auto mt-3" />
          </div>
          <div className="space-y-4">
            {[
              { q: 'How quickly will I get a response?', a: 'We aim to respond within 24 hours on business days. For urgent matters, please call us directly.' },
              { q: 'Can I schedule a demo?', a: "Yes — mention your preferred time in the message and we'll arrange a personalised demo for your school." },
              { q: 'Do you help with onboarding?', a: 'We provide setup guidance and answer questions as you get started, so your school can adopt WiSkul smoothly.' },
              { q: 'What if I have technical issues?', a: 'Reach our support team by email or phone. We respond quickly and will guide you through any issue.' },
            ].map((faq) => (
              <div key={faq.q} className="bg-[#f8fafc] border border-[#e5e9f2] rounded-xl p-6">
                <h4 className="text-sm font-bold text-slate-900 mb-2">{faq.q}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
};

export default ContactPage;
