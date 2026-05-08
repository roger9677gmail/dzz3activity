'use client';
import { useState } from 'react';

export default function PaymentForm({ registration, onSuccess }) {
  const [form, setForm] = useState({
    payment_status: registration.payment_status || 'unpaid',
    receipt_number: registration.receipt_number || '',
    receipt_title: registration.receipt_title || '',
    payment_date: registration.payment_date || '',
    payment_notes: registration.payment_notes || '',
  });
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
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaved(true);
        onSuccess && onSuccess(form);
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
            <label className="block text-sm font-medium text-gray-700 mb-1">收據單號</label>
            <input
              type="text"
              className="input-field"
              placeholder="輸入收據號碼"
              value={form.receipt_number}
              onChange={(e) => setForm((p) => ({ ...p, receipt_number: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">收據抬頭</label>
            <input
              type="text"
              className="input-field"
              placeholder={`預設：${registration.member_name || ''}`}
              value={form.receipt_title}
              onChange={(e) => setForm((p) => ({ ...p, receipt_title: e.target.value }))}
            />
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
