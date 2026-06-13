import { useToast } from '../context/ToastContext';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const icons = {
  success: <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />,
  error:   <XCircle    className="w-5 h-5 text-red-400    shrink-0" />,
  info:    <Info       className="w-5 h-5 text-brand-400  shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
};

const borders = {
  success: 'border-emerald-500/30',
  error:   'border-red-500/30',
  info:    'border-brand-500/30',
  warning: 'border-amber-500/30',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 w-80 max-w-[calc(100vw-2rem)]"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            toast-enter glass-card border ${borders[toast.type]}
            flex items-start gap-3 p-4 shadow-2xl shadow-black/40
          `}
        >
          {icons[toast.type]}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-100">{toast.title}</p>
            {toast.message && (
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{toast.message}</p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
