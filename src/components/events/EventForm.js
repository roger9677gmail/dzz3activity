'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const DEFAULT_COLORS = ['#8B1A1A', '#1A4A8B', '#1A6B2A', '#7A1A8B', '#8B5E1A'];

export default function EventForm({ event = null }) {
  const router = useRouter();
  const isEdit = !!event;

  const [form, setForm] = useState({
    name: event?.name || '',
    description: event?.description || '',
    start_date: event?.start_date || '',
    end_date: event?.end_date || '',
    registration_deadline: event?.registration_deadline || '',
    location: event?.location || '',
    status: event?.status || 'active',
    max_capacity: event?.max_capacity || '',
    banner_color: event?.banner_color || '#8B1A1A',
  });

  const [items, setItems] = useState(
    event?.items || [{ name: '', description: '', price: 0, max_quantity: 5, requires_name: true, requires_content: false }]
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function updateItem(idx, field, val) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { name: '', description: '', price: 0, max_quantity: 5, requires_name: true, requires_content: false }]);
  }

  function removeItem(idx) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (items.some((item) => !item.name.trim())) {
      setError('請填寫所有項目名稱');
      return;
    }

    setLoading(true);
    try {
      const url = isEdit ? `/api/events/${event.id}` : '/api/events';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '操作失敗');
      } else {
        if (isEdit) {
          // Update items separately
          await fetch(`/api/events/${event.id}/items`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items }),
          });
        }
        router.push('/admin/events');
        router.refresh();
      }
    } catch {
      setError('網路錯誤，請稍後再試');
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="bg-white rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-temple-dark border-b pb-2">基本資訊</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">活動名稱 *</label>
          <input type="text" required className="input-field" placeholder="例：中元普渡法會"
            value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">活動說明</label>
          <textarea className="input-field resize-none" rows={3} placeholder="活動說明（選填）"
            value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">開始日期 *</label>
            <input type="date" required className="input-field"
              value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">結束日期 *</label>
            <input type="date" required className="input-field"
              value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">報名截止日期 *</label>
          <input type="date" required className="input-field"
            value={form.registration_deadline} onChange={(e) => setForm((p) => ({ ...p, registration_deadline: e.target.value }))} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">地點</label>
          <input type="text" className="input-field" placeholder="活動地點（選填）"
            value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">狀態</label>
            <select className="input-field" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              <option value="active">報名中</option>
              <option value="draft">草稿</option>
              <option value="closed">已截止</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">人數上限</label>
            <input type="number" className="input-field" placeholder="無限制"
              value={form.max_capacity} onChange={(e) => setForm((p) => ({ ...p, max_capacity: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">主題顏色</label>
          <div className="flex gap-2">
            {DEFAULT_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setForm((p) => ({ ...p, banner_color: c }))}
                className={`w-8 h-8 rounded-full border-2 transition-all ${form.banner_color === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="flex justify-between items-center mb-3 border-b pb-2">
          <h3 className="font-bold text-temple-dark">報名項目</h3>
          <button type="button" onClick={addItem} className="text-sm text-temple-red font-medium">+ 新增項目</button>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-500">項目 {idx + 1}</span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-500 text-sm">移除</button>
                )}
              </div>
              <input type="text" required className="input-field text-sm" placeholder="項目名稱（如：光明燈）"
                value={item.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} />
              <input type="text" className="input-field text-sm" placeholder="項目說明（選填）"
                value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">金額（元）</label>
                  <input type="number" className="input-field text-sm" min={0}
                    value={item.price} onChange={(e) => updateItem(idx, 'price', parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500">最多數量</label>
                  <input type="number" className="input-field text-sm" min={1}
                    value={item.max_quantity} onChange={(e) => updateItem(idx, 'max_quantity', parseInt(e.target.value) || 1)} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={item.requires_name}
                  onChange={(e) => updateItem(idx, 'requires_name', e.target.checked)} />
                需要填寫功德主(陽上)姓名
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={!!item.requires_content}
                  onChange={(e) => updateItem(idx, 'requires_content', e.target.checked)} />
                需要填寫超渡內容
              </label>
            </div>
          ))}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="flex gap-3">
        <button type="button" onClick={() => router.back()} className="flex-1 btn-secondary">取消</button>
        <button type="submit" disabled={loading} className="flex-1 btn-primary">
          {loading ? '儲存中...' : isEdit ? '更新活動' : '建立活動'}
        </button>
      </div>
    </form>
  );
}
