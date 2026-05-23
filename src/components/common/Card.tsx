import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hover = false }) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 ${
        hover ? 'hover:border-slate-200 hover:shadow-sm transition-all duration-200' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
