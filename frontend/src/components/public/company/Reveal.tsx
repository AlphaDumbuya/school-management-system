/**
 * Reveal: fades and lifts its content in the first time it scrolls into view.
 * Without IntersectionObserver (or for people who prefer reduced motion) the content is simply shown.
 */
import React, { useEffect, useRef, useState } from 'react';
import '../../../styles/company.css';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger siblings: delay in milliseconds. */
  delay?: number;
}

export const Reveal: React.FC<RevealProps> = ({ children, className = '', delay = 0 }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reduce = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`co-reveal ${visible ? 'is-visible' : ''} ${className}`}
      style={delay ? ({ '--co-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
};

export default Reveal;
