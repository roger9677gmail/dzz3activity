'use client';
import { useEffect, useState } from 'react';

function isStandalone() {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  if (window.navigator.standalone === true) return true;
  return false;
}

// Two-icon "install to home screen" prompt for the login page.
// - iOS: Safari has no programmatic install — we show step-by-step Share → 加入主畫面.
// - Android/Chrome: if the browser fired `beforeinstallprompt` we trigger the
//   native install dialog; otherwise we fall back to the manual instructions.
export default function InstallAppButtons() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [openSheet, setOpenSheet] = useState(null); // 'ios' | 'android' | null

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (isStandalone()) { setInstalled(true); return undefined; }

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setOpenSheet(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleAndroidClick() {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setInstalled(true);
      } catch {}
      setDeferredPrompt(null);
      return;
    }
    setOpenSheet('android');
  }

  if (installed) return null;

  return (
    <>
      <div className="flex flex-col items-center gap-2 mt-6">
        <p className="text-xs text-gray-400">加到手機桌面，下次一鍵開啟</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setOpenSheet('ios')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:border-temple-red hover:text-temple-red transition-colors"
            aria-label="加到 iPhone 主畫面"
          >
            <AppleLogo />
            <span>iPhone</span>
          </button>
          <button
            type="button"
            onClick={handleAndroidClick}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-sm font-medium hover:border-temple-red hover:text-temple-red transition-colors"
            aria-label="加到 Android 主畫面"
          >
            <AndroidLogo />
            <span>Android</span>
          </button>
        </div>
      </div>

      {openSheet && (
        <InstallSheet platform={openSheet} onClose={() => setOpenSheet(null)} />
      )}
    </>
  );
}

function InstallSheet({ platform, onClose }) {
  const isIOS = platform === 'ios';
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-6 sm:pb-0"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="text-temple-red">
            {isIOS ? <AppleLogo size={28} /> : <AndroidLogo size={28} />}
          </div>
          <h3 className="text-base font-bold text-temple-dark">
            {isIOS ? '加到 iPhone 主畫面' : '加到 Android 主畫面'}
          </h3>
        </div>

        {isIOS ? (
          <ol className="text-sm text-gray-700 space-y-2 leading-relaxed">
            <li>
              <span className="font-medium text-temple-red mr-1">1.</span>
              請改用 <strong>Safari</strong> 開啟此頁面（Chrome / Line 內建瀏覽器不支援）。
            </li>
            <li>
              <span className="font-medium text-temple-red mr-1">2.</span>
              點下方工具列的「分享」<ShareIcon />。
            </li>
            <li>
              <span className="font-medium text-temple-red mr-1">3.</span>
              下滑找到 <strong>「加入主畫面」</strong>（Add to Home Screen）。
            </li>
            <li>
              <span className="font-medium text-temple-red mr-1">4.</span>
              點右上「加入」即完成，主畫面會出現 App 圖示。
            </li>
          </ol>
        ) : (
          <ol className="text-sm text-gray-700 space-y-2 leading-relaxed">
            <li>
              <span className="font-medium text-temple-red mr-1">1.</span>
              請改用 <strong>Chrome</strong> 開啟此頁面（其他瀏覽器步驟類似）。
            </li>
            <li>
              <span className="font-medium text-temple-red mr-1">2.</span>
              點右上角選單 <strong>⋮</strong>。
            </li>
            <li>
              <span className="font-medium text-temple-red mr-1">3.</span>
              選擇 <strong>「加到主畫面」</strong>或<strong>「安裝應用程式」</strong>。
            </li>
            <li>
              <span className="font-medium text-temple-red mr-1">4.</span>
              點「安裝」即完成，主畫面會出現 App 圖示。
            </li>
          </ol>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full btn-secondary py-2 text-sm"
        >
          知道了
        </button>
      </div>
    </div>
  );
}

function AppleLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.46 1.58-1.518 3.13-.92 1.36-1.88 2.71-3.4 2.74-1.482.03-1.96-.88-3.66-.88-1.7 0-2.225.85-3.633.91-1.466.05-2.581-1.46-3.512-2.81-1.898-2.76-3.35-7.81-1.4-11.22.97-1.69 2.7-2.76 4.59-2.79 1.43-.03 2.79.96 3.66.96.87 0 2.54-1.19 4.29-1.01.73.03 2.77.29 4.09 2.21-.11.07-2.44 1.42-2.41 4.24.03 3.37 2.95 4.49 2.99 4.51z" />
    </svg>
  );
}

function AndroidLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.523 15.34a1.06 1.06 0 1 1 1.06-1.06 1.06 1.06 0 0 1-1.06 1.06m-11.046 0a1.06 1.06 0 1 1 1.06-1.06 1.06 1.06 0 0 1-1.06 1.06m11.43-6.02 2.116-3.665a.44.44 0 0 0-.762-.44l-2.143 3.713a13.3 13.3 0 0 0-10.236 0L4.74 5.215a.44.44 0 1 0-.762.44L6.094 9.32A12.42 12.42 0 0 0 0 19.5h24a12.42 12.42 0 0 0-6.093-10.18" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      className="inline-block align-text-bottom mx-0.5"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <rect x="4" y="13" width="16" height="8" rx="2" />
    </svg>
  );
}
