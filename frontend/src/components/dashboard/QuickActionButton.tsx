import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
}

const variantStyles = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg',
  secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300',
  outline: 'border-2 border-gray-200 text-gray-700 hover:border-blue-500 hover:bg-blue-50',
};

export const QuickActionButton: React.FC<QuickActionButtonProps> = ({
  icon: Icon,
  label,
  description,
  onClick,
  variant = 'outline',
  disabled = false,
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center p-6 rounded-lg transition-all duration-300 ${variantStyles[variant]} ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <Icon size={28} className="mb-2" />
      <span className="font-semibold text-sm text-center">{label}</span>
      {description && <span className="text-xs opacity-75 mt-1 text-center">{description}</span>}
    </button>
  );
};

export default QuickActionButton;
