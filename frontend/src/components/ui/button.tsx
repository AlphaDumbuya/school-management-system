import React from 'react';

type Variant = 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'link';
type Size = 'default' | 'sm' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  default:     'bg-blue-600 text-white hover:bg-blue-700 border-transparent',
  secondary:   'bg-gray-100 text-gray-900 hover:bg-gray-200 border-transparent',
  outline:     'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
  ghost:       'bg-transparent text-gray-700 border-transparent hover:bg-gray-100',
  destructive: 'bg-red-600 text-white hover:bg-red-700 border-transparent',
  link:        'bg-transparent text-blue-600 border-transparent hover:underline p-0',
};

const sizeClasses: Record<Size, string> = {
  default: 'px-3 sm:px-4 py-2 text-sm',
  sm:      'px-2.5 sm:px-3 py-1.5 text-xs',
  lg:      'px-5 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base',
  icon:    'p-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'default',
  className = '',
  disabled,
  children,
  ...props
}) => (
  <button
    className={`
      inline-flex items-center justify-center gap-2 rounded-lg border font-medium
      transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
      disabled:opacity-50 disabled:cursor-not-allowed
      ${variantClasses[variant]}
      ${sizeClasses[size]}
      ${className}
    `}
    disabled={disabled}
    {...props}
  >
    {children}
  </button>
);

export default Button;
