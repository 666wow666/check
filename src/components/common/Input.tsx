import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-slate-600">
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-3 rounded-xl border border-slate-200 
          focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 
          outline-none transition-all duration-200
          ${error ? 'border-rose-400' : ''} ${className}`}
        {...props}
      />
      {error && (
        <p className="text-sm text-rose-500">{error}</p>
      )}
    </div>
  );
};
