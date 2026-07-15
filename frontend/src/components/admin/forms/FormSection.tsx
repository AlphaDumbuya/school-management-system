import React from 'react';

export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  columns?: 1 | 2; // default: 2
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  columns = 2,
}) => (
  <fieldset className="mb-6 border-0 p-0 m-0">
    <legend className="text-sm font-semibold text-gray-900 mb-1 w-full">{title}</legend>
    {description && <p className="text-xs text-gray-500 mb-3">{description}</p>}
    <hr className="border-gray-200 mb-4" />
    <div
      className={
        columns === 1 ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'
      }
    >
      {children}
    </div>
  </fieldset>
);

export default FormSection;
