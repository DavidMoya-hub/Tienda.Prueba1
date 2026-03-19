import React from 'react';
import { X, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  onConfirm,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar'
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle className="text-emerald-500" size={48} />;
      case 'warning': return <AlertCircle className="text-amber-500" size={48} />;
      case 'error': return <AlertCircle className="text-red-500" size={48} />;
      case 'confirm': return <HelpCircle className="text-blue-500" size={48} />;
      default: return <AlertCircle className="text-blue-500" size={48} />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl shadow-blue-900/20 animate-in zoom-in-95 duration-300">
        <div className="p-8 flex flex-col items-center text-center">
          <div className="mb-6 p-4 bg-slate-50 rounded-full">
            {getIcon()}
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">{title}</h3>
          <p className="text-slate-500 font-bold leading-relaxed">{message}</p>
        </div>
        
        <div className="p-6 bg-slate-50 flex flex-col sm:flex-row gap-3">
          {type === 'confirm' ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-6 py-4 rounded-2xl font-black text-slate-600 hover:bg-slate-100 transition-all uppercase tracking-widest text-xs"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm?.();
                  onClose();
                }}
                className="flex-1 px-6 py-4 rounded-2xl font-black text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all uppercase tracking-widest text-xs"
              >
                {confirmText}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full px-6 py-4 rounded-2xl font-black text-white bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all uppercase tracking-widest text-xs"
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;
