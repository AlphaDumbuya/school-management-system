/**
 * RichTextarea — Textarea with formatting toolbar
 * Supports: Bold, Italic, Underline, Bullet List, Numbered List, Headings
 * Stores content as HTML for rendering.
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Heading2 } from 'lucide-react';

interface RichTextareaProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  minHeight?: string;
}

export const RichTextarea: React.FC<RichTextareaProps> = ({
  value = '',
  onChange,
  placeholder = 'Type here...',
  label,
  required,
  error,
  helperText,
  minHeight = '120px',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Only set innerHTML from outside when value changes externally (not from typing)
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const execCommand = useCallback((command: string, cmdValue?: string) => {
    document.execCommand(command, false, cmdValue);
    editorRef.current?.focus();
    // Notify parent of change
    if (onChange && editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (onChange && editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const toolbarButtons = [
    { icon: <Bold size={15} />, command: 'bold', title: 'Bold (Ctrl+B)' },
    { icon: <Italic size={15} />, command: 'italic', title: 'Italic (Ctrl+I)' },
    { icon: <Underline size={15} />, command: 'underline', title: 'Underline (Ctrl+U)' },
    { icon: <Heading2 size={15} />, command: 'formatBlock', value: 'h3', title: 'Heading' },
    { icon: <List size={15} />, command: 'insertUnorderedList', title: 'Bullet List' },
    { icon: <ListOrdered size={15} />, command: 'insertOrderedList', title: 'Numbered List' },
  ];

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className={`border rounded-lg overflow-hidden transition-colors ${
        error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20'
      }`}>
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          {toolbarButtons.map((btn, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                execCommand(btn.command, btn.value);
              }}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              title={btn.title}
            >
              {btn.icon}
            </button>
          ))}
        </div>

        {/* Editor area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          data-placeholder={placeholder}
          className={`px-3 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none overflow-y-auto
            [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-gray-400 [&:empty]:before:dark:text-gray-500 [&:empty]:before:pointer-events-none
            [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1
            [&_li]:my-0.5
            [&_b]:font-bold [&_strong]:font-bold
            [&_i]:italic [&_em]:italic
            [&_u]:underline`}
          style={{ minHeight }}
        />
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {!error && helperText && <p className="text-xs text-gray-500 dark:text-gray-400">{helperText}</p>}
    </div>
  );
};

export default RichTextarea;
