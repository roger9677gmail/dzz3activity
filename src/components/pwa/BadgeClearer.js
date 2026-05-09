'use client';
import { useEffect } from 'react';
import { ensureSubscriptionSync } from '@/lib/push-client';

// When the member opens the app (or refocuses it):
//   1. Reset the unread badge counter (in the SW + locally).
//   2. Re-sync push subscription state with the server. This catches the case
//      where push_subscriptions was wiped (e.g. VAPID rotation) but the
//      browser still holds a stale subscription — without this the admin
//      sees 0 subscribers even though the device thinks it's subscribed.
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
    // Self-heal subscription in the background; subscribeIfPossible=false so
    // we don't silently re-subscribe a user who explicitly turned it off.
    ensureSubscriptionSync({ subscribeIfPossible: false }).catch(() => {});
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
