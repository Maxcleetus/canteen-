import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const DEFAULT_DURATION = 3500;

const TOAST_STYLES = {
  success: {
    icon: CheckCircle2,
    accent: 'text-green-600',
    border: 'border-green-200',
    surface: 'bg-white/95',
    title: 'text-slate-900',
    description: 'text-slate-500'
  },
  error: {
    icon: AlertCircle,
    accent: 'text-red-600',
    border: 'border-red-200',
    surface: 'bg-white/95',
    title: 'text-slate-900',
    description: 'text-slate-500'
  },
  info: {
    icon: Info,
    accent: 'text-sky-600',
    border: 'border-sky-200',
    surface: 'bg-white/95',
    title: 'text-slate-900',
    description: 'text-slate-500'
  }
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismissToast = (id) => {
    const timerId = timersRef.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      timersRef.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const showToast = ({ type = 'info', title, description = '', duration = DEFAULT_DURATION }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextToast = { id, type, title, description };

    setToasts((current) => [...current, nextToast]);

    const timerId = window.setTimeout(() => {
      dismissToast(id);
    }, duration);

    timersRef.current.set(id, timerId);
    return id;
  };

  useEffect(() => () => {
    timersRef.current.forEach((timerId) => {
      window.clearTimeout(timerId);
    });
    timersRef.current.clear();
  }, []);

  const value = {
    showToast,
    success: (title, description, options = {}) =>
      showToast({ ...options, type: 'success', title, description }),
    error: (title, description, options = {}) =>
      showToast({ ...options, type: 'error', title, description }),
    info: (title, description, options = {}) =>
      showToast({ ...options, type: 'info', title, description }),
    dismissToast
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[120] flex w-[min(92vw,24rem)] flex-col gap-3">
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
          const Icon = style.icon;

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto rounded-2xl border p-4 shadow-2xl backdrop-blur ${style.surface} ${style.border}`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${style.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${style.title}`}>{toast.title}</p>
                  {toast.description ? (
                    <p className={`mt-1 text-sm leading-5 ${style.description}`}>{toast.description}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return context;
};
