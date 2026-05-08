'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DeleteEventButton({ eventId, eventName, regCount = 0, paidCount = 0 }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    // 已繳款的報名 → 一律不允許刪除
    if (paidCount > 0) {
      alert(`「${eventName}」已有 ${paidCount} 筆已繳款報名，無法刪除。\n如需停辦，請將狀態改為「已截止」。`);
      return;
    }

    const unpaidCount = Math.max(0, regCount - paidCount);
    const warning = unpaidCount > 0
      ? `確定要刪除「${eventName}」？\n此動作無法復原，將一併刪除：\n  • 活動及所有項目\n  • ${unpaidCount} 筆未繳款報名紀錄`
      : `確定要刪除「${eventName}」？\n此動作無法復原，活動及所有項目將一併刪除。`;
    const confirmed = window.confirm(warning);
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
