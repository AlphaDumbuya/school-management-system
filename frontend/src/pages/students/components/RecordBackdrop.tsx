/**
 * RecordBackdrop: the page background of the parents' record forms. Same look as the hero of a school's public
 * page (deep brand gradient, soft drifting glows, dotted grid), so the form clearly belongs to the school.
 *
 * `color` is the school's own brand colour (#RRGGBB). It is applied as CSS variables on THIS wrapper only, so every
 * `primary-*` / `brand-deep` class inside takes the school's colour while the rest of the app keeps the platform
 * blue. Without a colour (or an invalid one) the default blue is used. In the School Editions the colour is global
 * and the prop is simply not passed.
 */
import React, { useMemo } from 'react';
import { isHexColor, paletteCssVars } from '../../../brand/palette';

export const RecordBackdrop: React.FC<{ children: React.ReactNode; color?: string | null }> = ({ children, color }) => {
  const vars = useMemo(() => (isHexColor(color) ? (paletteCssVars(color) as React.CSSProperties) : undefined), [color]);
  return (
    <main style={vars} className="relative isolate min-h-screen overflow-hidden bg-gradient-to-br from-brand-deeper via-brand-deep to-primary-700 px-4 py-8 text-white sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 -z-10 h-[26rem] w-[26rem] rounded-full bg-primary-400/30 blur-3xl sh-drift" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 right-[-6rem] -z-10 h-[30rem] w-[30rem] rounded-full bg-white/10 blur-3xl sh-drift" style={{ animationDelay: '-6s' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08]"
        style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '28px 28px' }} />
      {children}
    </main>
  );
};
export default RecordBackdrop;
