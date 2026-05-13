'use client';
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const ConfirmContext = createContext(null);

// confirm({ title, message, confirmText, cancelText, danger }) → Promise<boolean>
// Renders a styled modal in place of the native window.confirm() with full
// Tailwind theming, ESC/Enter keyboard handling, and a focus-trapped backdrop.
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      setState({
        title: opts.title || '請確認',
        message: opts.message || '',
        confirmText: opts.confirmText || '確定',
        cancelText: opts.cancelText || '取消',
        danger: !!opts.danger,
      });
      resolverRef.current = resolve;
    });
  }, []);

  function close(value) {
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
    setState(null);
  }

  useEffect(() => {
    if (!state) return;
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      else if (e.key === 'Enter') { e.preventDefault(); close(true); }
    }
    window.addEventListener('keydown', onKey);
    // Prevent background scroll while modal is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) close(false); }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-msg"
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5"
          >
            <h3 id="confirm-title" className="font-bold text-gray-800 text-base">{state.title}</h3>
            {state.message && (
              <p id="confirm-msg" className="mt-2 text-sm text-gray-600 whitespace-pre-line">{state.message}</p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => close(false)}
                className="btn-secondary flex-1"
              >{state.cancelText}</button>
              <button
                type="button"
                autoFocus
                onClick={() => close(true)}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  state.danger
                    ? 'bg-red-600 active:bg-red-700 focus:ring-red-400'
                    : 'bg-temple-red active:bg-temple-red-dark focus:ring-temple-red'
                }`}
              >{state.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // Graceful fallback: outside a provider (e.g. SSR snapshot warming, or
    // a missed wiring), return a stub that resolves false. Calling
    // window.confirm here would crash during SSR.
    return (opts = {}) => {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        return Promise.resolve(
          window.confirm(`${opts.title || ''}\n\n${opts.message || ''}`.trim())
        );
      }
      console.warn('useConfirm called without ConfirmProvider (SSR)');
      return Promise.resolve(false);
    };
  }
  return ctx;
}
