import React from 'react';

type Variant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variantClasses: Record<Variant, string> = {
  default:     'bg-blue-100 text-blue-700',
  secondary:   'bg-gray-100 text-gray-700',
  success:     'bg-green-100 text-green-700',
  warning:     'bg-yellow-100 text-yellow-700',
  destructive: 'bg-red-100 text-red-700',
  outline:     'bg-white text-gray-700 border border-gray-300',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  className = '',
  children,
  ...props
}) => (
  <span
    className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
      ${variantClasses[variant]}
      ${className}
    `}
    {...props}
  >
    {children}
  </span>
);

export default Badge;
