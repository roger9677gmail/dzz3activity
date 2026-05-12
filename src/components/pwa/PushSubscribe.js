'use client';
import { useState, useEffect } from 'react';
import {
  urlBase64ToUint8Array,
  syncSubscriptionToServer,
  ensureSubscriptionSync,
} from '@/lib/push-client';

// Apple 從 iOS 16.4 起才支援 Web Push，且強制要求 PWA 必須先「加入主畫面」
// 並從主畫面開啟，純 Safari 分頁的 requestPermission 不會跳通知請求。
// 偵測這個狀態給使用者明確指引，避免「點了開啟通知按鈕卻沒反應」。
function detectIosNeedsInstall() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Mac') && 'ontouchend' in document);
  if (!isIos) return false;
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  return !standalone;
}

export default function PushSubscribe() {
  const [status, setStatus] = useState('loading'); // loading | unsupported | subscribed | unsubscribed
  const [loading, setLoading] = useState(false);
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  useEffect(() => {
    setIosNeedsInstall(detectIosNeedsInstall());
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

  // iPhone 在純 Safari 分頁開（還沒加入主畫面）→ 不顯示「開啟通知」鈕，
  // 改顯示分步說明，否則按了等於沒效（Apple 限制）。
  if (status === 'unsubscribed' && iosNeedsInstall) {
    return (
      <div className="card p-4">
        <div className="font-medium text-temple-dark mb-1">法會活動推播通知</div>
        <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 leading-relaxed">
          📱 <strong>iPhone / iPad 需先把本系統加入主畫面</strong>，
          才能收到推播通知（這是 Apple 的限制，Safari 分頁無法收通知）：
          <ol className="list-decimal pl-5 mt-2 space-y-0.5 text-amber-900">
            <li>點 Safari 下方「分享」按鈕 <span className="inline-block">⬆</span></li>
            <li>下拉選單選「加入主畫面」</li>
            <li>從主畫面 ⛩️ 圖示重新打開本系統</li>
            <li>再回來這頁按「開啟通知」</li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-temple-dark">法會活動推播通知</div>
          <div className="text-sm text-gray-500 mt-0.5">
            {status === 'subscribed'
              ? '✅ 已開啟，將收到法會活動、報名截止、繳款等提醒'
              : '開啟後手機會收到法會活動、報名截止、繳款等提醒'}
          </div>
        </div>
        <button
          onClick={status === 'subscribed' ? unsubscribe : subscribe}
          disabled={loading}
          className={`shrink-0 text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
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
