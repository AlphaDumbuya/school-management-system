import React, { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'textarea' | 'select' | 'date';
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  readOnly?: boolean;
  options?: FormFieldOption[];
  error?: string;
  value?: string | number;
  className?: string;
}

const inputBaseClasses =
  'w-full rounded-lg border px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors';

const inputErrorClasses = 'border-red-500 focus:ring-red-500 pr-9';
const inputNormalClasses = 'border-gray-300';

export const FormField = forwardRef<
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  FormFieldProps
>(
  (
    {
      name,
      label,
      type = 'text',
      placeholder,
      helperText,
      required = false,
      readOnly = false,
      options = [],
      error,
      value,
      className,
      ...divProps
    },
    ref
  ) => {
    const hasError = !!error;
    const descriptionId = hasError
      ? `${name}-error`
      : helperText
      ? `${name}-helper`
      : undefined;

    const inputClasses = clsx(
      inputBaseClasses,
      hasError ? inputErrorClasses : inputNormalClasses
    );

    const renderInput = () => {
      if (readOnly) {
        return (
          <p className="py-2 px-3 text-sm text-gray-700 bg-gray-50 rounded-lg border border-gray-200 min-h-[38px]">
            {value ?? '—'}
          </p>
        );
      }

      if (type === 'textarea') {
        return (
          <div className="relative">
            <textarea
              id={name}
              name={name}
              ref={ref as React.Ref<HTMLTextAreaElement>}
              rows={4}
              placeholder={placeholder}
              aria-invalid={hasError}
              aria-describedby={descriptionId}
              className={inputClasses}
              defaultValue={value}
            />
            {hasError && (
              <AlertCircle
                size={14}
                className="absolute right-3 top-3 text-red-500 pointer-events-none"
              />
            )}
          </div>
        );
      }

      if (type === 'select') {
        return (
          <div className="relative">
            <select
              id={name}
              name={name}
              ref={ref as React.Ref<HTMLSelectElement>}
              aria-invalid={hasError}
              aria-describedby={descriptionId}
              className={inputClasses}
              defaultValue={value}
            >
              <option value="">Select...</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {hasError && (
              <AlertCircle
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none"
              />
            )}
          </div>
        );
      }

      return (
        <div className="relative">
          <input
            id={name}
            name={name}
            ref={ref as React.Ref<HTMLInputElement>}
            type={type}
            placeholder={placeholder}
            aria-invalid={hasError}
            aria-describedby={descriptionId}
            className={inputClasses}
            defaultValue={value}
          />
          {hasError && (
            <AlertCircle
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 pointer-events-none"
            />
          )}
        </div>
      );
    };

    return (
      <div className={clsx('flex flex-col gap-1', className)} {...divProps}>
        <label htmlFor={name} className="text-sm font-medium text-gray-700">
          {label}
          {required && (
            <span className="text-red-500 ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>

        {renderInput()}

        {hasError && (
          <p id={`${name}-error`} className="text-xs text-red-600 flex items-center gap-1">
            {error}
          </p>
        )}

        {!hasError && helperText && (
          <p id={`${name}-helper`} className="text-xs text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

FormField.displayName = 'FormField';

export default FormField;
