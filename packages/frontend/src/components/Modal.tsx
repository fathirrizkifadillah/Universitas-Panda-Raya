import React, { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  isWarning?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  isWarning = false,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#20251D]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-brand-border overflow-hidden transition-all transform scale-100"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-border bg-[#FAFBF8]">
          <div className="flex items-center gap-2.5">
            {isWarning && <AlertTriangle className="w-5 h-5 text-amber-600" />}
            <h3 id="modal-title" className="text-base font-extrabold text-brand-deep">
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-ink-muted hover:text-brand-charcoal hover:bg-brand-canvas transition-colors cursor-pointer"
            aria-label="Tutup modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {description && (
            <p className="text-xs font-medium text-amber-900 bg-amber-50/80 p-3 rounded-xl border border-amber-200 mb-4 leading-relaxed">
              {description}
            </p>
          )}
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-brand-border bg-[#FAFBF8]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
