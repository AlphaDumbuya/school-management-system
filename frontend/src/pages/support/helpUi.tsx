/**
 * Shared UI primitives for the help center: icon map, the Rich inline-link
 * renderer, and a block renderer for article content.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Rocket, CalendarClock, Settings, Users, GraduationCap, ClipboardCheck,
  Wallet, CreditCard, CalendarDays, BarChart2, ShieldCheck, Smartphone,
  Receipt, Building, Wrench, BookOpen, Lightbulb, Info, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import type { RichText, HelpBlock } from '@lib/helpCenter';

export const COLLECTION_ICONS: Record<string, LucideIcon> = {
  Rocket, CalendarClock, Settings, Users, GraduationCap, ClipboardCheck,
  Wallet, CreditCard, CalendarDays, BarChart2, ShieldCheck, Smartphone,
  Receipt, Building, Wrench, BookOpen,
};

/** Render a rich paragraph, turning link tokens into inline anchors. */
export const Rich: React.FC<{ text: RichText; className?: string }> = ({ text, className }) => (
  <span className={className}>
    {text.map((seg, i) => {
      if (typeof seg === 'string') return <React.Fragment key={i}>{seg}</React.Fragment>;
      const cls = 'font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 underline decoration-blue-300 underline-offset-2';
      // External links (mailto:, http) use a plain anchor.
      if (/^(mailto:|https?:)/.test(seg.to)) {
        return <a key={i} href={seg.to} className={cls}>{seg.text}</a>;
      }
      return <Link key={i} to={seg.to} className={cls}>{seg.text}</Link>;
    })}
  </span>
);

const CALLOUT: Record<string, { ring: string; bg: string; icon: LucideIcon; iconCls: string }> = {
  tip: { ring: 'border-emerald-200 dark:border-emerald-900/40', bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: Lightbulb, iconCls: 'text-emerald-600 dark:text-emerald-400' },
  note: { ring: 'border-blue-200 dark:border-blue-900/40', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: Info, iconCls: 'text-blue-600 dark:text-blue-400' },
  warning: { ring: 'border-amber-200 dark:border-amber-900/40', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: AlertTriangle, iconCls: 'text-amber-600 dark:text-amber-400' },
};

/** Render a single content block. */
export const Block: React.FC<{ block: HelpBlock }> = ({ block }) => {
  switch (block.type) {
    case 'p':
      return <p className="text-[15px] text-gray-600 dark:text-gray-300 leading-relaxed"><Rich text={block.text} /></p>;

    case 'list':
      return (
        <ul className="space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] text-gray-600 dark:text-gray-300 leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
              <span><Rich text={it} /></span>
            </li>
          ))}
        </ul>
      );

    case 'steps':
      return (
        <ol className="space-y-4">
          {block.items.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white">{s.title}</p>
                {s.body.map((b, bi) => (
                  <p key={bi} className="text-[15px] text-gray-600 dark:text-gray-300 mt-0.5 leading-relaxed"><Rich text={b} /></p>
                ))}
                {s.action && (
                  <Link to={s.action.to} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">
                    {s.action.label} →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      );

    case 'callout': {
      const c = CALLOUT[block.tone];
      const Icon = c.icon;
      return (
        <div className={`rounded-xl border ${c.ring} ${c.bg} p-4 flex gap-3`}>
          <Icon size={18} className={`${c.iconCls} shrink-0 mt-0.5`} />
          <div className="min-w-0">
            {block.title && <p className="text-sm font-bold text-gray-900 dark:text-white mb-0.5">{block.title}</p>}
            <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed"><Rich text={block.text} /></p>
          </div>
        </div>
      );
    }

    case 'table':
      return (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>{block.head.map((h, i) => <th key={i} className="text-left font-bold text-gray-700 dark:text-gray-200 px-4 py-2.5">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {block.rows.map((row, ri) => (
                <tr key={ri} className="align-top">
                  {row.map((cell, ci) => (
                    <td key={ci} className={`px-4 py-2.5 text-gray-600 dark:text-gray-300 ${ci === 0 ? 'font-semibold text-gray-900 dark:text-white whitespace-nowrap' : ''}`}>
                      <Rich text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    default:
      return null;
  }
};
