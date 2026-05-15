'use client';
import { useState, useMemo } from 'react';

export default function PaymentForm({ registration, onSuccess }) {
  const fallbackTitle = (
    (registration.receipt_title || '').trim() ||
    (registration.member_name || '').trim()
  );

  // Group items by their effective receipt_title so each unique title gets its
  // own receipt number input.
  const initialReceipts = useMemo(() => {
    const items = registration.items || [];
    const map = new Map();
    for (const item of items) {
      const t = ((item.receipt_title || '').trim()) || fallbackTitle;
      if (!map.has(t)) map.set(t, { title: t, receipt_number: '' });
      if (item.receipt_number && !map.get(t).receipt_number) {
        map.get(t).receipt_number = item.receipt_number;
      }
    }
    const groups = Array.from(map.values());
    // Backward-compat: pre-fill from registration-level receipt_number for items
    // that don't have a per-item value yet.
    if (registration.receipt_number) {
      const empty = groups.find((g) => !g.receipt_number);
      if (empty) empty.receipt_number = registration.receipt_number;
    }
    if (groups.length === 0) {
      groups.push({ title: fallbackTitle, receipt_number: registration.receipt_number || '' });
    }
    return groups;
  }, [registration, fallbackTitle]);

  const [form, setForm] = useState({
    payment_status: registration.payment_status || 'unpaid',
    payment_date: registration.payment_date || '',
    payment_notes: registration.payment_notes || '',
  });
  const [receipts, setReceipts] = useState(initialReceipts);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/registrations/${registration.id}/payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, receipts }),
      });
      if (res.ok) {
        setSaved(true);
        const first = receipts.find((r) => r.receipt_number);
        onSuccess && onSuccess({
          ...form,
          receipt_number: first?.receipt_number || '',
          receipt_title: first?.title || '',
          items: (registration.items || []).map((it) => {
            const t = ((it.receipt_title || '').trim()) || fallbackTitle;
            const match = receipts.find((r) => r.title === t);
            return { ...it, receipt_number: match?.receipt_number || null };
          }),
        });
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">繳款狀態</label>
        <select
          className="input-field"
          value={form.payment_status}
          onChange={(e) => setForm((p) => ({ ...p, payment_status: e.target.value }))}
        >
          <option value="unpaid">未繳款</option>
          <option value="paid">已繳款</option>
        </select>
      </div>

      {form.payment_status === 'paid' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              收據單號
              {receipts.length > 1 && (
                <span className="ml-1 text-xs text-gray-400 font-normal">（依收據抬頭分別輸入）</span>
              )}
            </label>
            <div className="space-y-2">
              {receipts.map((r, idx) => (
                <div key={`${r.title}-${idx}`} className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500">收據抬頭：{r.title || '（未設定）'}</span>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="輸入收據號碼"
                    value={r.receipt_number}
                    onChange={(e) => {
                      const v = e.target.value;
                      setReceipts((prev) => prev.map((p, i) => (i === idx ? { ...p, receipt_number: v } : p)));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">繳款日期</label>
            <input
              type="date"
              className="input-field"
              value={form.payment_date}
              onChange={(e) => setForm((p) => ({ ...p, payment_date: e.target.value }))}
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">備註</label>
        <textarea
          className="input-field resize-none"
          rows={2}
          placeholder="繳款相關備註..."
          value={form.payment_notes}
          onChange={(e) => setForm((p) => ({ ...p, payment_notes: e.target.value }))}
        />
      </div>

      <button type="submit" disabled={loading} className="w-full btn-primary">
        {loading ? '儲存中...' : saved ? '✅ 已儲存' : '儲存繳款資訊'}
      </button>
    </form>
  );
}
