'use client';
import { useState, useEffect } from 'react';
import {
  urlBase64ToUint8Array,
  syncSubscriptionToServer,
  ensureSubscriptionSync,
} from '@/lib/push-client';

export default function PushSubscribe() {
  const [status, setStatus] = useState('loading'); // loading | unsupported | subscribed | unsubscribed
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    (async () => {
      const sub = await ensureSubscriptionSync();
      setStatus(sub ? 'subscribed' : 'unsubscribed');
    })();
  }, []);

  async function subscribe() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey || vapidKey === 'YOUR_VAPID_PUBLIC_KEY_HERE') {
      alert('推播通知尚未設定，請聯繫管理員');
      return;
    }

    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('請允許通知權限以接收法會提醒');
        setLoading(false);
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await syncSubscriptionToServer(sub);
      setStatus('subscribed');
    } catch (err) {
      console.error(err);
      alert('訂閱失敗，請稍後再試');
    }
    setLoading(false);
  }

  async function unsubscribe() {
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        try {
          await fetch('/api/push/unsubscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        } catch {}
        await sub.unsubscribe();
      }
      setStatus('unsubscribed');
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  if (status === 'loading' || status === 'unsupported') return null;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium text-temple-dark">法會活動推播通知</div>
          <div className="text-sm text-gray-500 mt-0.5">
            {status === 'subscribed' ? '✅ 已開啟，將收到法會提醒' : '開啟後可收到法會通知'}
          </div>
        </div>
        <button
          onClick={status === 'subscribed' ? unsubscribe : subscribe}
          disabled={loading}
          className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
            status === 'subscribed'
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'btn-primary text-xs py-1.5'
          }`}
        >
          {loading ? '處理中...' : status === 'subscribed' ? '關閉通知' : '開啟通知'}
        </button>
      </div>
    </div>
  );
}
