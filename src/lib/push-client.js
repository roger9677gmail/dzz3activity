// Shared client-side helpers for Web Push subscription management.

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function arrayBufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export function arrayBufferToBase64Url(buf) {
  return arrayBufferToBase64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function syncSubscriptionToServer(sub) {
  const p256dh = arrayBufferToBase64(sub.getKey('p256dh'));
  const auth = arrayBufferToBase64(sub.getKey('auth'));
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint, p256dh, auth }),
  });
}

// Heals stale subscriptions and ensures the server has a row that matches the
// browser's current subscription. Returns the resulting PushSubscription, or
// null if the user has no subscription / push isn't supported.
export async function ensureSubscriptionSync({ subscribeIfPossible = true } = {}) {
  if (typeof navigator === 'undefined') return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    if (sub && vapidKey) {
      const subKey = sub.options?.applicationServerKey;
      if (subKey) {
        const subKeyB64 = arrayBufferToBase64Url(subKey);
        if (subKeyB64 !== vapidKey) {
          // Stale (signed with a previous VAPID public key after rotation).
          try { await sub.unsubscribe(); } catch {}
          sub = null;
        }
      }
      if (sub && Notification.permission !== 'granted') {
        try { await sub.unsubscribe(); } catch {}
        sub = null;
      }
    }

    if (!sub && subscribeIfPossible && Notification.permission === 'granted' && vapidKey) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      } catch {
        sub = null;
      }
    }

    if (sub) {
      try { await syncSubscriptionToServer(sub); } catch {}
    }
    return sub;
  } catch {
    return null;
  }
}
