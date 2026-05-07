'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteEventButton({ eventId, eventName, regCount = 0 }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (regCount > 0) {
      alert(`「${eventName}」已有 ${regCount} 筆報名紀錄，無法刪除。\n如需停辦，請將狀態改為「已截止」。`);
      return;
    }

    const confirmed = window.confirm(`確定要刪除「${eventName}」？\n此動作無法復原，活動及所有項目將一併刪除。`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || '刪除失敗');
      } else {
        router.refresh();
      }
    } catch {
      alert('網路錯誤，請稍後再試');
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="text-center text-sm py-1.5 px-3 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {loading ? '刪除中...' : '刪除'}
    </button>
  );
}
