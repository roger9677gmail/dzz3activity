'use client';
import { useEffect, useState } from 'react';
import { urlBase64ToUint8Array, syncSubscriptionToServer } from '@/lib/push-client';

const DISMISS_KEY = 'pushPromptDismissed';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if (window.navigator.standalone === true) return true;
  return false;
}

// Auto-shows once after the user adds the PWA to their home screen and opens it,
// asking them to enable push. The actual permission request still happens on the
// user's button click (browsers require a user gesture).
export default function PushInstallPrompt() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (!isStandalone()) return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled && !sub) {
          setTimeout(() => { if (!cancelled) setShow(true); }, 600);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  function dismiss(remember) {
    if (remember) {
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    }
    setShow(false);
  }

  async function enable() {
    setError('');
    setLoading(true);
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setError('推播通知尚未設定，請聯繫管理員');
        setLoading(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('需要通知權限才能訂閱；可至手機設定中重新允許');
        setLoading(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }
      await syncSubscriptionToServer(sub);
      try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
      setShow(false);
    } catch (err) {
      console.error(err);
      setError('訂閱失敗，請稍後再試');
    }
    setLoading(false);
  }

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-6 sm:pb-0">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        <div className="text-3xl text-center mb-2">🔔</div>
        <h3 className="text-lg font-bold text-temple-dark text-center mb-1">開啟法會提醒通知</h3>
        <p className="text-sm text-gray-600 text-center mb-4 leading-relaxed">
          在您的手機收到法會活動、報名截止與繳款提醒，避免錯過重要訊息。
        </p>
        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-3">{error}</div>
        )}
        <button
          onClick={enable}
          disabled={loading}
          className="w-full btn-primary py-3 mb-2"
        >
          {loading ? '處理中…' : '開啟通知'}
        </button>
        <div className="flex justify-between text-xs text-gray-400 px-1">
          <button type="button" onClick={() => dismiss(false)} className="hover:text-gray-600">稍後提醒</button>
          <button type="button" onClick={() => dismiss(true)} className="hover:text-gray-600">不再顯示</button>
        </div>
      </div>
    </div>
  );
}
