/**
 * PhoneFrame: a phone showing a REAL screenshot of one of the app's own screens.
 * The pictures are made by the edition tool `npm run edition:screens` (the actual pages, opened on a
 * phone-sized screen, with invented names and figures), so they cannot drift from the real app.
 */
import React, { useState } from 'react';
import '../../../styles/company.css';

interface PhoneFrameProps {
  src: string;
  alt: string;
  className?: string;
  /** Load straight away (above the fold) instead of lazily. */
  eager?: boolean;
  /** Re-run the small fade-in when this value changes. */
  animateKey?: string;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({ src, alt, className = '', eager = false, animateKey }) => {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return (
    <div className={`relative mx-auto w-[220px] sm:w-[250px] ${className}`}>
      <div className="relative rounded-[2.4rem] bg-slate-900 p-2.5 shadow-2xl shadow-black/40 ring-1 ring-white/25">
        <span aria-hidden="true" className="absolute left-1/2 top-[1.15rem] z-10 h-2 w-2 -translate-x-1/2 rounded-full bg-slate-800 ring-1 ring-slate-700" />
        <div className="overflow-hidden rounded-[1.9rem] bg-white">
          <img
            key={animateKey ?? src}
            src={src}
            width={390}
            height={844}
            alt={alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className="co-pop block aspect-[390/844] w-full object-cover object-top"
            onError={() => setMissing(true)}
          />
        </div>
      </div>
    </div>
  );
};

export default PhoneFrame;
