'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ImpersonationBannerClient({ targetName, adminName, mode }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function endImpersonation() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/admin/impersonate/end', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '結束模擬失敗');
        setBusy(false);
        return;
      }
      // Send the admin back to /admin so they land somewhere they actually
      // have permission to be; router.refresh ensures the new cookie + the
      // re-read session take effect server-side.
      router.replace('/admin');
      router.refresh();
    } catch (err) {
      console.error('end impersonation failed:', err);
      alert('結束模擬失敗，請重試');
      setBusy(false);
    }
  }

  const isWrite = mode === 'write';
  const bgClass = isWrite
    ? 'bg-red-600 text-white border-red-700'
    : 'bg-amber-400 text-amber-950 border-amber-500';

  return (
    <div
      role="alert"
      className={`sticky top-0 z-[60] border-b shadow-sm ${bgClass}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="px-3 py-2 flex items-center gap-2 flex-wrap text-sm">
        <span className="font-bold">⚠ 模擬中</span>
        <span>
          以 <strong>{targetName || '師兄姐'}</strong> 身分操作
          {adminName && <>（管理員：{adminName}）</>}
          <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-white/30">
            {isWrite ? '可寫' : '唯讀'}
          </span>
        </span>
        <button
          type="button"
          onClick={endImpersonation}
          disabled={busy}
          className={`ml-auto text-xs font-medium px-3 py-1 rounded-full border transition-colors ${
            isWrite
              ? 'bg-white text-red-700 border-white hover:bg-red-50'
              : 'bg-white text-amber-900 border-amber-700 hover:bg-amber-50'
          } disabled:opacity-50`}
        >
          {busy ? '結束中…' : '✕ 結束模擬'}
        </button>
      </div>
    </div>
  );
}
