/**
 * VerifiedBadge — "Verified School" indicator, shown only when the owner/tenant
 * is verified. Optionally pairs with the profile photo.
 */
import React from 'react';
import { BadgeCheck } from 'lucide-react';

interface Props {
  size?: number;
  withLabel?: boolean;
  className?: string;
}

export const VerifiedBadge: React.FC<Props> = ({ size = 16, withLabel = true, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 text-emerald-600 ${className}`}
    title="Verified School"
  >
    <BadgeCheck size={size} className="fill-emerald-100" />
    {withLabel && <span className="text-xs font-bold">Verified</span>}
  </span>
);

export default VerifiedBadge;
