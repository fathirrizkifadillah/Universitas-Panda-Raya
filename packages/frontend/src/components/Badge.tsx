import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'olive' | 'bamboo';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', size = 'sm' }) => {
  const base = 'inline-flex items-center font-medium rounded-full';
  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  const variants = {
    success: 'bg-[#EEF4E8] text-[#344522] border border-[#A3B18A]',
    warning: 'bg-[#FBF6EC] text-[#8C6425] border border-[#C9A66B]/50',
    danger: 'bg-rose-50 text-rose-800 border border-rose-200',
    info: 'bg-[#F2F6ED] text-[#435525] border border-[#BAC9AA]',
    neutral: 'bg-[#F0F2EB] text-[#4A5543] border border-[#DDE3D4]',
    olive: 'bg-[#344522] text-[#F8F9F5] border border-[#344522]',
    bamboo: 'bg-[#FDF8EE] text-[#7A551E] border border-[#C9A66B]',
  };

  return (
    <span className={`${base} ${sizeClasses} ${variants[variant]}`}>
      {children}
    </span>
  );
};
