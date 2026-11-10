/**
 * ProductSubNav: a pill bar at the bottom of each WiSkul School Platform page, so Features, Pricing and the
 * other product pages are always one tap apart (and the School Edition is one tap away too).
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const ITEMS: { label: string; to: string }[] = [
  { label: 'Overview', to: '/wiskul' },
  { label: 'Features', to: '/features' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'Why WiSkul', to: '/why' },
  { label: 'Benefits', to: '/benefits' },
  { label: 'School Edition', to: '/editions' },
];

export const ProductSubNav: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <nav aria-label="WiSkul school platform" className="relative z-10 max-w-[1400px] mx-auto mt-10 flex flex-col items-center gap-3">
      <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-amber-300">WiSkul School Platform</p>
      <ul className="flex flex-wrap justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] p-1.5 backdrop-blur-sm">
        {ITEMS.map((i) => {
          const active = pathname === i.to;
          return (
            <li key={i.to}>
              <Link
                to={i.to}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  active ? 'bg-white text-[#1a2b6b] shadow' : 'text-blue-100/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default ProductSubNav;
