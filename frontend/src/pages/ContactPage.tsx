/**
 * ContactPage - /contact
 * Stunning cyber security-themed contact page with Brevo integration
 * Features: Contact form, auto-response, email templates, animated background
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PublicNavbar from '@components/public';

const contactSchema = z.object({
  name: z.string().min(1, 'Full name is required').max(100, 'Max 100 characters'),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  phone: z.string().optional().or(z.literal('')),
  school: z.string().optional().or(z.literal('')),
  role: z.string().min(1, 'Please select your role'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000, 'Max 2000 characters'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export const ContactPage: React.FC = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      school: '',
      role: '',
      message: '',
    },
  });

  const onSubmit = async (data: ContactFormValues) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSubmitStatus('success');
        reset();
      } else {
        const resData = await response.json();
        throw new Error(resData.message || 'Failed to send message');
      }
    } catch (error: any) {
      setSubmitStatus('error');
      setErrorMessage(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white overflow-x-hidden font-sans">

      {/* Navigation */}
      <PublicNavbar ctaText="Register School Free" />

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6 sm:px-10 overflow-hidden">
        {/* Animated Background Grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(0,212,170,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,170,0.5) 1px, transparent 1px)`,
          backgroundSize: '80px 80px',
        }} />

        {/* Floating Orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[10%] left-[5%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-cyan-500/10 blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-[#16213e]/50 border border-[#00d4aa]/30 rounded-full px-6 py-2.5 mb-8 backdrop-blur-xl">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d4aa] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00d4aa]"></span>
              </span>
              <span className="text-[#00d4aa] text-xs font-bold tracking-widest uppercase">We're Here to Help</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight mb-6">
              <span className="bg-gradient-to-r from-white via-cyan-200 to-purple-200 bg-clip-text text-transparent">
                Get in Touch
              </span>
              <br />
              <span className="text-[#00d4aa]">With WiSkul</span>
            </h1>

            <p className="text-gray-400 text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
              Have questions about our platform? Want to see a demo? Need help with implementation? 
              Our team is ready to assist you.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Form & Info Section */}
      <section className="px-6 sm:px-10 py-16 relative">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          {/* Contact Information Cards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Card */}
            <div className="relative group">
              <div className="absolute -inset-[1px] bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-500" />
              <div className="relative bg-[#16213e]/80 border border-white/[0.08] rounded-2xl p-8 backdrop-blur-xl">
                <h3 className="text-xl font-black text-white mb-6">Contact Information</h3>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-xl flex-shrink-0">
                      📧
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-400 mb-1">Email</p>
                      <p className="text-white text-sm">alphadumbuya7@gmail.com</p>
                      <p className="text-gray-500 text-xs">We reply within 24 hours</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-xl flex-shrink-0">
                      📱
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-400 mb-1">Phone</p>
                      <p className="text-white text-sm">+232 78 261 892</p>
                      <p className="text-gray-500 text-xs">Mon-Fri, 9AM - 5PM</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4aa] to-green-700 flex items-center justify-center text-xl flex-shrink-0">
                      📍
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-400 mb-1">Office</p>
                      <p className="text-white text-sm">75 Main Road</p>
                      <p className="text-gray-500 text-xs">Kossoh Town, Sierra Leone</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links Card */}
            <div className="relative group">
              <div className="absolute -inset-[1px] bg-gradient-to-br from-[#00d4aa]/20 to-purple-500/20 rounded-2xl opacity-0 group-hover:opacity-100 blur-lg transition-opacity duration-500" />
              <div className="relative bg-[#16213e]/80 border border-white/[0.08] rounded-2xl p-8 backdrop-blur-xl">
                <h3 className="text-xl font-black text-white mb-6">Quick Links</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Features', path: '/features' },
                    { label: 'Pricing', path: '/pricing' },
                    { label: 'Why WiSkul', path: '/why' },
                    { label: 'Benefits', path: '/benefits' },
                  ].map((link) => (
                    <button
                      key={link.path}
                      onClick={() => navigate(link.path)}
                      className="flex items-center justify-between w-full text-left py-2.5 px-4 rounded-lg hover:bg-white/[0.05] transition-colors group/item"
                    >
                      <span className="text-sm text-gray-300 group-hover/item:text-white transition-colors">{link.label}</span>
                      <span className="text-[#00d4aa] opacity-0 group-hover/item:opacity-100 transition-opacity">→</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Response Time Badge */}
            <div className="bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border border-purple-500/30 rounded-2xl p-6 text-center">
              <div className="text-4xl mb-3">⚡</div>
              <p className="text-2xl font-black text-white mb-2">&lt; 24 Hours</p>
              <p className="text-sm text-gray-400">Average Response Time</p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-3">
            <div className="relative group">
              <div className="absolute -inset-[1px] bg-gradient-to-br from-purple-500/30 to-cyan-500/30 rounded-3xl opacity-50 group-hover:opacity-100 blur-xl transition-opacity duration-500" />
              
              <div className="relative bg-gradient-to-br from-[#16213e]/90 to-[#0f0f1a]/90 border border-white/[0.08] rounded-3xl p-8 sm:p-10 backdrop-blur-xl">
                <h3 className="text-2xl font-black text-white mb-6">Send Us a Message</h3>
                
                {submitStatus === 'success' && (
                  <div className="mb-6 bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-start gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="text-green-400 font-bold text-sm mb-1">Message Sent!</p>
                      <p className="text-gray-400 text-xs">Thank you for contacting us. We'll get back to you within 24 hours.</p>
                    </div>
                  </div>
                )}

                {submitStatus === 'error' && (
                  <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                    <span className="text-2xl">❌</span>
                    <div>
                      <p className="text-red-400 font-bold text-sm mb-1">Error</p>
                      <p className="text-gray-400 text-xs">{errorMessage}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-2">Full Name *</label>
                      <input
                        type="text"
                        {...register('name')}
                        placeholder="John Doe"
                        className={`w-full bg-[#0a0a14] border rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-colors ${
                          errors.name ? 'border-red-500/50 focus:border-red-500' : 'border-white/[0.08] focus:border-[#00d4aa]/50'
                        }`}
                      />
                      {errors.name && (
                        <p className="mt-1.5 text-xs text-red-400">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-2">Email Address *</label>
                      <input
                        type="email"
                        {...register('email')}
                        placeholder="john@school.com"
                        className={`w-full bg-[#0a0a14] border rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-colors ${
                          errors.email ? 'border-red-500/50 focus:border-red-500' : 'border-white/[0.08] focus:border-[#00d4aa]/50'
                        }`}
                      />
                      {errors.email && (
                        <p className="mt-1.5 text-xs text-red-400">{errors.email.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-2">Phone Number</label>
                      <input
                        type="tel"
                        {...register('phone')}
                        placeholder="+232 76 123 456"
                        className={`w-full bg-[#0a0a14] border rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-colors ${
                          errors.phone ? 'border-red-500/50 focus:border-red-500' : 'border-white/[0.08] focus:border-[#00d4aa]/50'
                        }`}
                      />
                      {errors.phone && (
                        <p className="mt-1.5 text-xs text-red-400">{errors.phone.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-400 mb-2">School Name</label>
                      <input
                        type="text"
                        {...register('school')}
                        placeholder="ABC International School"
                        className={`w-full bg-[#0a0a14] border rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-colors ${
                          errors.school ? 'border-red-500/50 focus:border-red-500' : 'border-white/[0.08] focus:border-[#00d4aa]/50'
                        }`}
                      />
                      {errors.school && (
                        <p className="mt-1.5 text-xs text-red-400">{errors.school.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-2">Your Role *</label>
                    <select
                      {...register('role')}
                      className={`w-full bg-[#0a0a14] border rounded-xl px-4 py-3.5 text-sm text-white outline-none transition-colors ${
                        errors.role ? 'border-red-500/50 focus:border-red-500' : 'border-white/[0.08] focus:border-[#00d4aa]/50'
                      }`}
                    >
                      <option value="">Select your role</option>
                      <option value="principal">Principal</option>
                      <option value="admin">School Administrator</option>
                      <option value="teacher">Teacher</option>
                      <option value="parent">Parent</option>
                      <option value="owner">School Owner</option>
                      <option value="other">Other</option>
                    </select>
                    {errors.role && (
                      <p className="mt-1.5 text-xs text-red-400">{errors.role.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-400 mb-2">Message *</label>
                    <textarea
                      {...register('message')}
                      rows={5}
                      placeholder="Tell us how we can help you..."
                      className={`w-full bg-[#0a0a14] border rounded-xl px-4 py-3.5 text-sm text-white placeholder-gray-600 outline-none transition-colors resize-none ${
                        errors.message ? 'border-red-500/50 focus:border-red-500' : 'border-white/[0.08] focus:border-[#00d4aa]/50'
                      }`}
                    />
                    {errors.message && (
                      <p className="mt-1.5 text-xs text-red-400">{errors.message.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-[#00d4aa] to-cyan-500 hover:from-cyan-500 hover:to-[#00d4aa] text-[#0a0a14] font-bold text-sm py-4 rounded-xl transition-all duration-300 shadow-[0_0_30px_rgba(0,212,170,0.3)] hover:shadow-[0_0_40px_rgba(0,212,170,0.5)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending...
                      </span>
                    ) : (
                      'Send Message'
                    )}
                  </button>

                  <p className="text-xs text-gray-500 text-center mt-4">
                    By submitting this form, you agree to our Privacy Policy and Terms of Service.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6 sm:px-10 py-20 bg-[#0f0f1a]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">Frequently Asked Questions</h2>
            <p className="text-gray-500 text-sm">Quick answers to common questions</p>
          </div>
          <div className="space-y-4">
            {[
              { 
                q: 'How quickly will I get a response?', 
                a: 'We aim to respond to all inquiries within 24 hours during business days. For urgent matters, please call us directly.' 
              },
              { 
                q: 'Can I schedule a demo?', 
                a: 'Absolutely! Mention your preferred time in the message, and we\'ll arrange a personalized demo of WiSkul for your school.' 
              },
              { 
                q: 'Do you offer onboarding support?', 
                a: 'Yes! Every new school gets dedicated onboarding support, training sessions, and ongoing assistance to ensure smooth adoption.' 
              },
              { 
                q: 'What if I have technical issues?', 
                a: 'Our support team is available via email, phone, and live chat. Plus, we have a comprehensive knowledge base and video tutorials.' 
              },
            ].map((faq) => (
              <div key={faq.q} className="bg-[#16213e]/50 border border-white/[0.06] rounded-xl p-6 backdrop-blur-xl hover:border-[#00d4aa]/30 transition-all duration-300">
                <h4 className="text-sm font-bold text-white mb-2">{faq.q}</h4>
                <p className="text-xs text-gray-400 leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0a14] border-t border-white/[0.04] px-6 sm:px-10 py-8 text-center">
        <p className="text-gray-600 text-xs">© {new Date().getFullYear()} WiSkul. We're here to help your school succeed.</p>
      </footer>
    </div>
  );
};

export default ContactPage;
