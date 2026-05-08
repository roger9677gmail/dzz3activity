'use client';
import { useEffect } from 'react';

// When the member opens the app (or refocuses it), reset the unread badge.
// Source of truth lives in the service worker's IndexedDB, so we ping it via
// postMessage; we also clear locally for snappier UX.
function clearBadge() {
  try {
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_BADGE' });
    }
  } catch {}
}

export default function BadgeClearer() {
  useEffect(() => {
    clearBadge();
    const onFocus = () => clearBadge();
    const onVisibility = () => { if (document.visibilityState === 'visible') clearBadge(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return null;
}
