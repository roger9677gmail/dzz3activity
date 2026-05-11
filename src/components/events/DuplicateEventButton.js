'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DuplicateEventButton({ eventId, eventName }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDuplicate() {
    const defaultName = `${eventName}（複本）`;
    const name = window.prompt(`複製「${eventName}」\n\n請輸入新活動名稱：`, defaultName);
    if (name == null) return;
    const trimmed = String(name).trim();
    if (!trimmed) {
      alert('活動名稱不可為空');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || '複製失敗');
        setLoading(false);
        return;
      }
      router.push(`/admin/events/${data.id}`);
    } catch {
      alert('網路錯誤，請稍後再試');
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDuplicate}
      disabled={loading}
      className="text-center text-sm py-1.5 px-3 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
    >
      {loading ? '複製中…' : '複製'}
    </button>
  );
}
