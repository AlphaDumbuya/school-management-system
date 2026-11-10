/**
 * What WiSkul builds for any organisation (not only schools). Used on the home page and the services page.
 * Keep the wording to things the team can deliver; edit here and both pages follow.
 */
import type { LucideIcon } from 'lucide-react';
import { Globe, ShoppingCart, Smartphone, Briefcase, CreditCard, Palette, BarChart3, Server } from 'lucide-react';

export interface CatalogService {
  id: string;
  icon: LucideIcon;
  title: string;
  text: string;
  points: string[];
  tint: string;
}

export const SERVICES_CATALOG: CatalogService[] = [
  {
    id: 'web',
    icon: Globe,
    title: 'Websites and web apps',
    text: 'Fast, mobile-friendly websites and web applications for businesses, churches, NGOs, schools and institutions.',
    points: ['Company and organisation websites', 'Portals, dashboards and booking systems', 'Built to load well on mobile networks'],
    tint: 'from-[#1d4ed8] to-[#1a2b6b]',
  },
  {
    id: 'shop',
    icon: ShoppingCart,
    title: 'Online stores',
    text: 'Sell online with a shop that takes mobile money and card payments and keeps track of your stock and orders.',
    points: ['Product catalogue and orders', 'Mobile money and card checkout', 'Stock and sales reports'],
    tint: 'from-[#059669] to-[#065f46]',
  },
  {
    id: 'mobile',
    icon: Smartphone,
    title: 'Mobile apps',
    text: 'Android apps and installable web apps that keep working when the connection does not.',
    points: ['Android apps for your customers or staff', 'Installable web apps for any phone', 'Offline use that syncs when back online'],
    tint: 'from-[#7c3aed] to-[#4c1d95]',
  },
  {
    id: 'custom',
    icon: Briefcase,
    title: 'Custom business software',
    text: 'Management systems built around the way your organisation works: records, approvals, staff and reports.',
    points: ['Membership, stock, staff and client records', 'Roles, approvals and audit trails', 'Reports you can act on'],
    tint: 'from-[#f59e0b] to-[#b45309]',
  },
  {
    id: 'payments',
    icon: CreditCard,
    title: 'Payments and integrations',
    text: 'Accept mobile money and card payments, and connect your systems to the services you already use.',
    points: ['Mobile money and card payments through Monime', 'Email and messaging', 'Connecting systems through APIs'],
    tint: 'from-[#0891b2] to-[#155e75]',
  },
  {
    id: 'design',
    icon: Palette,
    title: 'Design and branding',
    text: 'Clear, modern design for your product, from your logo and colours to every screen people use.',
    points: ['Logo, colour and visual identity', 'Interface and experience design', 'Designs that work on small screens'],
    tint: 'from-[#e11d48] to-[#9f1239]',
  },
  {
    id: 'data',
    icon: BarChart3,
    title: 'Data and dashboards',
    text: 'Turn the records you already keep into dashboards and reports, and bring spreadsheets into a proper system.',
    points: ['Import from spreadsheets', 'Dashboards and exports to Excel and PDF', 'Clean-up and structure for your data'],
    tint: 'from-[#1d4ed8] to-[#7c3aed]',
  },
  {
    id: 'cloud',
    icon: Server,
    title: 'Hosting, security and support',
    text: 'We host, secure, back up and maintain what we build, and we answer when you need us.',
    points: ['Secure hosting and backups', 'Sign-in protection and access control', 'Updates, fixes and support'],
    tint: 'from-[#475569] to-[#1e293b]',
  },
];
